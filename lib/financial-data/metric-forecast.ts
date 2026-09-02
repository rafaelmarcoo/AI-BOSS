import {
  HISTORICAL_METRIC_KEYS,
  readFinancialMetricHistorySeries,
  summarizeMetricHistory,
  summarizeMetricHistorySeries,
  type HistoricalMetricKey,
  type MetricHistoryRecordLimit,
  type MetricHistoryRange,
  type MetricHistorySeriesCollection,
  type MetricHistorySummary,
} from '@/lib/financial-data/metric-history'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'
import type { SupportedFinancialCurrency } from '@/lib/financial-data/currency'
import { readDerivedRunwayHistory } from '@/lib/financial-data/runway-history'

export const FORECAST_HORIZONS = [3, 6] as const
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number]

export interface MetricForecastPoint {
  date: string
  value: number
  kind: 'forecast'
}

export interface MetricForecastSummary {
  metricKey: HistoricalMetricKey
  label: string
  range: MetricHistoryRange
  horizon: ForecastHorizon
  history: MetricHistorySummary
  forecastPoints: MetricForecastPoint[]
  latestActualValue: number | null
  monthlySlope: number | null
  method: 'date_aware_linear_trend'
  assumptions: string[]
}

export interface MetricForecastSeriesCollection
  extends Omit<MetricHistorySeriesCollection, 'series'> {
  horizon: ForecastHorizon
  series: MetricForecastSummary[]
}

const DAYS_PER_MONTH = 30.4375

function round(value: number) {
  return Number(value.toFixed(2))
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function addCalendarMonths(date: string, months: number) {
  const source = parseDate(date)
  const sourceDay = source.getUTCDate()
  const sourceIsMonthEnd =
    sourceDay ===
    new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0)).getUTCDate()
  const targetMonthStart = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1)
  )
  const targetMonthEnd = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0
    )
  )
  const targetDay = sourceIsMonthEnd
    ? targetMonthEnd.getUTCDate()
    : Math.min(sourceDay, targetMonthEnd.getUTCDate())
  const result = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      targetDay
    )
  )
  return result.toISOString().slice(0, 10)
}

function calculateMonthlySlope(history: MetricHistorySummary) {
  const firstPoint = history.points[0]
  if (!firstPoint || history.points.length < 2) return null

  const firstDate = parseDate(firstPoint.date).valueOf()
  const coordinates = history.points.map((point) => ({
    months: (parseDate(point.date).valueOf() - firstDate) / 86_400_000 / DAYS_PER_MONTH,
    value: point.value,
  }))
  const meanMonths = coordinates.reduce((total, point) => total + point.months, 0) / coordinates.length
  const meanValue = coordinates.reduce((total, point) => total + point.value, 0) / coordinates.length
  const denominator = coordinates.reduce(
    (total, point) => total + (point.months - meanMonths) ** 2,
    0
  )

  if (denominator === 0) return null

  const numerator = coordinates.reduce(
    (total, point) => total + (point.months - meanMonths) * (point.value - meanValue),
    0
  )

  return round(numerator / denominator)
}

function buildMetricForecastFromHistory(
  history: MetricHistorySummary,
  horizon: ForecastHorizon
): MetricForecastSummary {
  const latestPoint = history.points[history.points.length - 1]
  const monthlySlope =
    history.direction === 'insufficient_data' || history.hasIncompatibleCurrencies
      ? null
      : calculateMonthlySlope(history)
  const forecastPoints =
    latestPoint && monthlySlope !== null
      ? Array.from({ length: horizon }, (_, index) => {
          const value = latestPoint.value + monthlySlope * (index + 1)

          return {
            date: addCalendarMonths(latestPoint.date, index + 1),
            value: round(history.metricKey === 'runway_months' ? Math.max(0, value) : value),
            kind: 'forecast' as const,
          }
        })
      : []

  return {
    metricKey: history.metricKey,
    label: history.label,
    range: history.range,
    horizon,
    history,
    forecastPoints,
    latestActualValue: latestPoint?.value ?? null,
    monthlySlope,
    method: 'date_aware_linear_trend',
    assumptions: [
      'Projects the observed date-aware linear trend from the latest actual value.',
      'This is a trend continuation estimate, not a guaranteed prediction.',
      ...(history.hasMixedSources
        ? ['Historical inputs combine multiple sources and should be compared cautiously.']
        : []),
      ...(history.hasRecordedDateFallback
        ? ['At least one input uses its recorded/upload date because a reporting date was unavailable.']
        : []),
      ...(history.excludedCurrencyObservationCount > 0
        ? [`${history.excludedCurrencyObservationCount} observation(s) with missing or unsupported currency were excluded.`]
        : []),
    ],
  }
}

export function summarizeMetricForecast(params: {
  metricKey: HistoricalMetricKey
  range: MetricHistoryRange
  horizon: ForecastHorizon
  observations: AvailableFinancialMetricValue[]
  recordLimit?: MetricHistoryRecordLimit
}): MetricForecastSummary {
  const history = summarizeMetricHistory({
    metricKey: params.metricKey,
    range: params.range,
    observations: params.observations,
    recordLimit: params.recordLimit,
  })

  return buildMetricForecastFromHistory(history, params.horizon)
}

export function summarizeMetricForecastSeries(params: {
  metricKey: HistoricalMetricKey
  range: MetricHistoryRange
  horizon: ForecastHorizon
  observations: AvailableFinancialMetricValue[]
  recordLimit?: MetricHistoryRecordLimit
  currency?: SupportedFinancialCurrency | null
  sourceKey?: string | null
}): MetricForecastSeriesCollection {
  const histories = summarizeMetricHistorySeries(params)

  return {
    ...histories,
    horizon: params.horizon,
    series: histories.series.map((history) =>
      buildMetricForecastFromHistory(history, params.horizon)
    ),
  }
}

export async function readFinancialMetricForecast(params: {
  userId: string
  metricKey: HistoricalMetricKey
  range?: MetricHistoryRange
  horizon?: ForecastHorizon
}) {
  const range = params.range ?? 'all'
  const horizon = params.horizon ?? 3
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

  return summarizeMetricForecast({
    metricKey: params.metricKey,
    range,
    horizon,
    observations,
  })
}

export async function readFinancialMetricForecastSeries(params: {
  userId: string
  metricKey: HistoricalMetricKey
  range?: MetricHistoryRange
  horizon?: ForecastHorizon
  recordLimit?: MetricHistoryRecordLimit
  currency?: SupportedFinancialCurrency | null
  sourceKey?: string | null
}) {
  const range = params.range ?? 'all'
  const horizon = params.horizon ?? 3
  if (params.metricKey === 'runway_months') {
    const histories = await readFinancialMetricHistorySeries({
      userId: params.userId,
      metricKey: params.metricKey,
      range,
      recordLimit: params.recordLimit,
      currency: params.currency,
      sourceKey: params.sourceKey,
    })

    return {
      ...histories,
      horizon,
      series: histories.series.map((history) =>
        buildMetricForecastFromHistory(history, horizon)
      ),
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

  return summarizeMetricForecastSeries({
    metricKey: params.metricKey,
    range,
    horizon,
    observations,
    recordLimit: params.recordLimit,
    currency: params.currency,
    sourceKey: params.sourceKey,
  })
}

export function isForecastHorizon(value: number): value is ForecastHorizon {
  return FORECAST_HORIZONS.includes(value as ForecastHorizon)
}

export { HISTORICAL_METRIC_KEYS }
