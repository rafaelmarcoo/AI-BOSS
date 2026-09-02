import {
  FINANCIAL_METRIC_LABELS,
  type FinancialMetricKey,
} from '@/lib/financial-data/metric-keys'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'
import { isSupportedFinancialCurrency } from '@/lib/financial-data/currency'
import type { SupportedFinancialCurrency } from '@/lib/financial-data/currency'
import {
  readDerivedRunwayHistory,
  type DerivedRunwayVariant,
} from '@/lib/financial-data/runway-history'

export const HISTORICAL_METRIC_KEYS = [
  'cash',
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
  'runway_months',
] as const satisfies readonly FinancialMetricKey[]

export type HistoricalMetricKey = (typeof HISTORICAL_METRIC_KEYS)[number]
export type MetricHistoryRange = '3m' | '6m' | 'all'
export const METRIC_HISTORY_RECORD_LIMITS = [12, 25, 50, 'all'] as const
export type MetricHistoryRecordLimit =
  (typeof METRIC_HISTORY_RECORD_LIMITS)[number]
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
  runwayVariant?: DerivedRunwayVariant
  seriesKey?: string
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

export interface MetricHistorySourceOption {
  key: string
  label: string
  sourceId: string | null
  sourceType: AvailableFinancialMetricValue['provenance']['sourceType']
}

export interface MetricHistorySeriesCollection {
  metricKey: HistoricalMetricKey
  label: string
  range: MetricHistoryRange
  recordLimit: MetricHistoryRecordLimit
  selectedCurrency: SupportedFinancialCurrency | null
  selectedSourceKey: string | null
  availableCurrencies: SupportedFinancialCurrency[]
  availableSources: MetricHistorySourceOption[]
  series: MetricHistorySummary[]
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

function getSourceKey(observation: AvailableFinancialMetricValue) {
  const { sourceId, sourceLabel, sourceType } = observation.provenance

  return sourceId
    ? `${sourceType}:${sourceId}`
    : `${sourceType}:label:${sourceLabel}`
}

function listSourceOptions(observations: AvailableFinancialMetricValue[]) {
  const sources = new Map<string, MetricHistorySourceOption>()

  for (const observation of observations) {
    const key = getSourceKey(observation)

    if (!sources.has(key)) {
      sources.set(key, {
        key,
        label: observation.provenance.sourceLabel,
        sourceId: observation.provenance.sourceId ?? null,
        sourceType: observation.provenance.sourceType,
      })
    }
  }

  return [...sources.values()].sort((left, right) =>
    left.label.localeCompare(right.label)
  )
}

function applyRecordLimit(
  observations: AvailableFinancialMetricValue[],
  recordLimit: MetricHistoryRecordLimit
) {
  return recordLimit === 'all'
    ? observations
    : observations.slice(-recordLimit)
}

function filterObservationsByRange(
  observations: AvailableFinancialMetricValue[],
  range: MetricHistoryRange,
  recordLimit: MetricHistoryRecordLimit
) {
  if (observations.length === 0) return []

  if (range === 'all') {
    return applyRecordLimit(observations, recordLimit)
  }

  const latest = getEffectiveDate(observations[observations.length - 1])
  const latestDate = parseDate(latest.date)

  if (!latestDate) return applyRecordLimit(observations, recordLimit)

  const months = range === '3m' ? 3 : 6
  const cutoff = new Date(latestDate)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)

  return applyRecordLimit(
    observations.filter((observation) => {
      const date = parseDate(getEffectiveDate(observation).date)
      return date && date >= cutoff
    }),
    recordLimit
  )
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
  recordLimit?: MetricHistoryRecordLimit
  runwayVariant?: DerivedRunwayVariant
  seriesKey?: string
}): MetricHistorySummary {
  const selectedForRange = filterObservationsByRange(
    selectLatestObservationPerDate(params.observations),
    params.range,
    params.recordLimit ?? 12
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
      ...(params.runwayVariant ? { runwayVariant: params.runwayVariant } : {}),
      ...(params.seriesKey ? { seriesKey: params.seriesKey } : {}),
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
    ...(params.runwayVariant ? { runwayVariant: params.runwayVariant } : {}),
    ...(params.seriesKey ? { seriesKey: params.seriesKey } : {}),
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

export function summarizeMetricHistorySeries(params: {
  metricKey: HistoricalMetricKey
  range: MetricHistoryRange
  observations: AvailableFinancialMetricValue[]
  recordLimit?: MetricHistoryRecordLimit
  currency?: SupportedFinancialCurrency | null
  sourceKey?: string | null
  runwayVariant?: DerivedRunwayVariant
}): MetricHistorySeriesCollection {
  const recordLimit = params.recordLimit ?? 12
  const isMonetaryMetric = params.metricKey !== 'runway_months'
  const availableSources = listSourceOptions(params.observations)
  const sourceFiltered = params.sourceKey
    ? params.observations.filter(
        (observation) => getSourceKey(observation) === params.sourceKey
      )
    : params.observations
  const availableCurrencies = [
    ...new Set(
      sourceFiltered.flatMap((observation) =>
        isSupportedFinancialCurrency(observation.currency)
          ? [observation.currency]
          : []
      )
    ),
  ].sort() as SupportedFinancialCurrency[]
  const selected = params.currency
    ? sourceFiltered.filter(
        (observation) => observation.currency === params.currency
      )
    : sourceFiltered
  const currencyAudit = summarizeMetricHistory({
    metricKey: params.metricKey,
    range: params.range,
    observations: sourceFiltered,
    recordLimit,
  })
  const series = isMonetaryMetric
    ? availableCurrencies
        .filter((currency) => !params.currency || currency === params.currency)
        .map((currency) =>
          summarizeMetricHistory({
            metricKey: params.metricKey,
            range: params.range,
            observations: selected.filter(
              (observation) => observation.currency === currency
            ),
            recordLimit,
            runwayVariant: params.runwayVariant,
            seriesKey: `currency:${currency}`,
          })
        )
        .filter((summary) => summary.points.length > 0)
    : listSourceOptions(selected)
        .map((source) =>
          summarizeMetricHistory({
            metricKey: params.metricKey,
            range: params.range,
            observations: selected.filter(
              (observation) => getSourceKey(observation) === source.key
            ),
            recordLimit,
            runwayVariant: params.runwayVariant,
            seriesKey: source.key,
          })
        )
        .filter((summary) => summary.points.length > 0)
        .map((summary) => ({
          ...summary,
          label:
            params.runwayVariant === 'working_capital_adjusted'
              ? 'Working-capital-adjusted runway'
              : 'Cash runway',
        }))

  return {
    metricKey: params.metricKey,
    label:
      params.metricKey === 'runway_months'
        ? 'Runway'
        : FINANCIAL_METRIC_LABELS[params.metricKey],
    range: params.range,
    recordLimit,
    selectedCurrency: params.currency ?? null,
    selectedSourceKey: params.sourceKey ?? null,
    availableCurrencies,
    availableSources,
    series,
    excludedCurrencyObservationCount:
      currencyAudit.excludedCurrencyObservationCount,
    hasMissingCurrencyObservations:
      currencyAudit.hasMissingCurrencyObservations,
    unsupportedCurrencies: currencyAudit.unsupportedCurrencies,
  }
}

export async function readFinancialMetricHistory(params: {
  userId: string
  metricKey: HistoricalMetricKey
  range?: MetricHistoryRange
}) {
  const range = params.range ?? 'all'
  const observations = params.metricKey === 'runway_months'
    ? await readDerivedRunwayHistory(params.userId, 'cash')
    : await (async () => {
        const { listFinancialMetricObservationHistory } = await import(
          '@/lib/financial-data/persistence'
        )
        return listFinancialMetricObservationHistory({
          userId: params.userId,
          metricKey: params.metricKey,
          limit: 100,
        })
      })()

  return summarizeMetricHistory({
    metricKey: params.metricKey,
    range,
    observations,
  })
}

export async function readFinancialMetricHistorySeries(params: {
  userId: string
  metricKey: HistoricalMetricKey
  range?: MetricHistoryRange
  recordLimit?: MetricHistoryRecordLimit
  currency?: SupportedFinancialCurrency | null
  sourceKey?: string | null
}) {
  const range = params.range ?? 'all'
  if (params.metricKey === 'runway_months') {
    const [cashObservations, adjustedObservations] = await Promise.all([
      readDerivedRunwayHistory(params.userId, 'cash'),
      readDerivedRunwayHistory(params.userId, 'working_capital_adjusted'),
    ])
    const sharedParams = {
      metricKey: params.metricKey,
      range,
      recordLimit: params.recordLimit,
      currency: params.currency,
      sourceKey: params.sourceKey,
    }
    const cash = summarizeMetricHistorySeries({
      ...sharedParams,
      observations: cashObservations,
      runwayVariant: 'cash',
    })
    const adjusted = summarizeMetricHistorySeries({
      ...sharedParams,
      observations: adjustedObservations,
      runwayVariant: 'working_capital_adjusted',
    })

    return {
      ...cash,
      label: 'Runway',
      availableSources: cash.availableSources,
      availableCurrencies: [
        ...new Set([...cash.availableCurrencies, ...adjusted.availableCurrencies]),
      ].sort(),
      series: [...cash.series, ...adjusted.series],
    }
  }

  const observations = await (async () => {
        const { listFinancialMetricObservationHistory } = await import(
          '@/lib/financial-data/persistence'
        )
        return listFinancialMetricObservationHistory({
          userId: params.userId,
          metricKey: params.metricKey,
          limit: 'all',
        })
      })()

  return summarizeMetricHistorySeries({
    metricKey: params.metricKey,
    range,
    observations,
    recordLimit: params.recordLimit,
    currency: params.currency,
    sourceKey: params.sourceKey,
  })
}
