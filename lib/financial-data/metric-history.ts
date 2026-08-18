import {
  FINANCIAL_METRIC_LABELS,
  type FinancialMetricKey,
} from '@/lib/financial-data/metric-keys'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'
import { isSupportedFinancialCurrency } from '@/lib/financial-data/currency'

export const HISTORICAL_METRIC_KEYS = [
  'cash',
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
  'runway_months',
] as const satisfies readonly FinancialMetricKey[]

export type HistoricalMetricKey = (typeof HISTORICAL_METRIC_KEYS)[number]
export type MetricHistoryRange = '3m' | '6m' | 'all'
export type MetricHistoryMovement = 'increased' | 'decreased' | 'stable'
export type MetricHistoryDirection =
  | 'improving'
  | 'worsening'
  | 'stable'
  | 'insufficient_data'
export type MetricHistoryDateSource = 'as_of_date' | 'period_end' | 'updated_at'

export interface MetricHistoryPoint {
  date: string
  dateSource: MetricHistoryDateSource
  value: number
  currency: string | null
  sourceLabel: string
  sourceType: AvailableFinancialMetricValue['provenance']['sourceType']
  confidence: number
  updatedAt: string
}

export interface MetricHistorySummary {
  metricKey: HistoricalMetricKey
  label: string
  range: MetricHistoryRange
  points: MetricHistoryPoint[]
  movement: MetricHistoryMovement | null
  direction: MetricHistoryDirection
  firstValue: number | null
  latestValue: number | null
  totalChange: number | null
  percentageChange: number | null
  averageChange: number | null
  currency: string | null
  sourceLabels: string[]
  hasMixedSources: boolean
  hasRecordedDateFallback: boolean
  hasIncompatibleCurrencies: boolean
  excludedCurrencyObservationCount: number
  hasMissingCurrencyObservations: boolean
  unsupportedCurrencies: string[]
}

function normaliseDate(value: string) {
  return value.slice(0, 10)
}

function parseDate(value: string) {
  const date = new Date(`${normaliseDate(value)}T00:00:00.000Z`)
  return Number.isNaN(date.valueOf()) ? null : date
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function getEffectiveDate(metric: AvailableFinancialMetricValue) {
  if (metric.asOfDate) {
    return { date: normaliseDate(metric.asOfDate), dateSource: 'as_of_date' as const }
  }

  if (metric.periodEnd) {
    return { date: normaliseDate(metric.periodEnd), dateSource: 'period_end' as const }
  }

  return { date: normaliseDate(metric.updatedAt), dateSource: 'updated_at' as const }
}

function selectLatestObservationPerDate(
  observations: AvailableFinancialMetricValue[]
) {
  const byDate = new Map<string, AvailableFinancialMetricValue>()

  for (const observation of observations) {
    const { date } = getEffectiveDate(observation)
    const dateCurrencyKey = `${date}:${observation.currency ?? 'missing'}`
    const existing = byDate.get(dateCurrencyKey)

    if (!existing || observation.updatedAt > existing.updatedAt) {
      byDate.set(dateCurrencyKey, observation)
    }
  }

  return [...byDate.values()].sort((left, right) => {
    const leftDate = getEffectiveDate(left).date
    const rightDate = getEffectiveDate(right).date
    return leftDate.localeCompare(rightDate)
  })
}

function filterObservationsByRange(
  observations: AvailableFinancialMetricValue[],
  range: MetricHistoryRange
) {
  if (observations.length === 0) return []

  if (range === 'all') {
    return observations.slice(-12)
  }

  const latest = getEffectiveDate(observations[observations.length - 1])
  const latestDate = parseDate(latest.date)

  if (!latestDate) return observations.slice(-12)

  const months = range === '3m' ? 3 : 6
  const cutoff = new Date(latestDate)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)

  return observations
    .filter((observation) => {
      const date = parseDate(getEffectiveDate(observation).date)
      return date && date >= cutoff
    })
    .slice(-12)
}

function getDirection(
  metricKey: HistoricalMetricKey,
  movement: MetricHistoryMovement
): Exclude<MetricHistoryDirection, 'insufficient_data'> {
  if (movement === 'stable') return 'stable'

  const higherIsBetter =
    metricKey === 'cash' ||
    metricKey === 'monthly_revenue' ||
    metricKey === 'runway_months'

  return higherIsBetter
    ? movement === 'increased'
      ? 'improving'
      : 'worsening'
    : movement === 'increased'
      ? 'worsening'
      : 'improving'
}

export function summarizeMetricHistory(params: {
  metricKey: HistoricalMetricKey
  range: MetricHistoryRange
  observations: AvailableFinancialMetricValue[]
}): MetricHistorySummary {
  const selectedForRange = filterObservationsByRange(
    selectLatestObservationPerDate(params.observations),
    params.range
  )
  const isMonetaryMetric = params.metricKey !== 'runway_months'
  const hasMissingCurrencyObservations =
    isMonetaryMetric &&
    selectedForRange.some((observation) => observation.currency === null)
  const unsupportedCurrencies = isMonetaryMetric
    ? [
        ...new Set(
          selectedForRange.flatMap((observation) =>
            observation.currency &&
            !isSupportedFinancialCurrency(observation.currency)
              ? [observation.currency]
              : []
          )
        ),
      ]
    : []
  const selected = isMonetaryMetric
    ? selectedForRange.filter((observation) =>
        isSupportedFinancialCurrency(observation.currency)
      )
    : selectedForRange
  const excludedCurrencyObservationCount =
    selectedForRange.length - selected.length
  const points = selected.map((observation) => {
    const effectiveDate = getEffectiveDate(observation)

    return {
      date: effectiveDate.date,
      dateSource: effectiveDate.dateSource,
      value: observation.value,
      currency: observation.currency,
      sourceLabel: observation.provenance.sourceLabel,
      sourceType: observation.provenance.sourceType,
      confidence: observation.confidence,
      updatedAt: observation.updatedAt,
    }
  })
  const sourceLabels = [...new Set(points.map((point) => point.sourceLabel))]
  const currencies = [...new Set(points.flatMap((point) => (point.currency ? [point.currency] : [])))]
  const hasIncompatibleCurrencies = currencies.length > 1
  const hasComparableData = points.length >= 2 && !hasIncompatibleCurrencies

  if (!hasComparableData) {
    return {
      metricKey: params.metricKey,
      label: FINANCIAL_METRIC_LABELS[params.metricKey],
      range: params.range,
      points,
      movement: null,
      direction: 'insufficient_data',
      firstValue: points[0]?.value ?? null,
      latestValue: points[points.length - 1]?.value ?? null,
      totalChange: null,
      percentageChange: null,
      averageChange: null,
      currency: currencies[0] ?? null,
      sourceLabels,
      hasMixedSources: sourceLabels.length > 1,
      hasRecordedDateFallback: points.some((point) => point.dateSource === 'updated_at'),
      hasIncompatibleCurrencies,
      excludedCurrencyObservationCount,
      hasMissingCurrencyObservations,
      unsupportedCurrencies,
    }
  }

  const firstValue = points[0].value
  const latestValue = points[points.length - 1].value
  const totalChange = round(latestValue - firstValue)
  const movement: MetricHistoryMovement =
    totalChange > 0 ? 'increased' : totalChange < 0 ? 'decreased' : 'stable'

  return {
    metricKey: params.metricKey,
    label: FINANCIAL_METRIC_LABELS[params.metricKey],
    range: params.range,
    points,
    movement,
    direction: getDirection(params.metricKey, movement),
    firstValue,
    latestValue,
    totalChange,
    percentageChange: firstValue === 0 ? null : round((totalChange / Math.abs(firstValue)) * 100),
    averageChange: round(totalChange / (points.length - 1)),
    currency: currencies[0] ?? null,
    sourceLabels,
    hasMixedSources: sourceLabels.length > 1,
    hasRecordedDateFallback: points.some((point) => point.dateSource === 'updated_at'),
    hasIncompatibleCurrencies: false,
    excludedCurrencyObservationCount,
    hasMissingCurrencyObservations,
    unsupportedCurrencies,
  }
}

export async function readFinancialMetricHistory(params: {
  userId: string
  metricKey: HistoricalMetricKey
  range?: MetricHistoryRange
}) {
  const range = params.range ?? 'all'
  const { listFinancialMetricObservationHistory } = await import(
    '@/lib/financial-data/persistence'
  )
  const observations = await listFinancialMetricObservationHistory({
    userId: params.userId,
    metricKey: params.metricKey,
    limit: 100,
  })

  return summarizeMetricHistory({
    metricKey: params.metricKey,
    range,
    observations,
  })
}
