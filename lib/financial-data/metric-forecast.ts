import {
  HISTORICAL_METRIC_KEYS,
  summarizeMetricHistory,
  type HistoricalMetricKey,
  type MetricHistoryRange,
  type MetricHistorySummary,
} from '@/lib/financial-data/metric-history'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'

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

const DAYS_PER_MONTH = 30.4375

function round(value: number) {
  return Number(value.toFixed(2))
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function addCalendarMonths(date: string, months: number) {
  const result = parseDate(date)
  result.setUTCMonth(result.getUTCMonth() + months)
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

export function summarizeMetricForecast(params: {
  metricKey: HistoricalMetricKey
  range: MetricHistoryRange
  horizon: ForecastHorizon
  observations: AvailableFinancialMetricValue[]
}): MetricForecastSummary {
  const history = summarizeMetricHistory({
    metricKey: params.metricKey,
    range: params.range,
    observations: params.observations,
  })
  const latestPoint = history.points[history.points.length - 1]
  const monthlySlope =
    history.direction === 'insufficient_data' || history.hasIncompatibleCurrencies
      ? null
      : calculateMonthlySlope(history)
  const forecastPoints =
    latestPoint && monthlySlope !== null
      ? Array.from({ length: params.horizon }, (_, index) => {
          const value = latestPoint.value + monthlySlope * (index + 1)

          return {
            date: addCalendarMonths(latestPoint.date, index + 1),
            value: round(params.metricKey === 'runway_months' ? Math.max(0, value) : value),
            kind: 'forecast' as const,
          }
        })
      : []

  return {
    metricKey: params.metricKey,
    label: history.label,
    range: params.range,
    horizon: params.horizon,
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

export async function readFinancialMetricForecast(params: {
  userId: string
  metricKey: HistoricalMetricKey
  range?: MetricHistoryRange
  horizon?: ForecastHorizon
}) {
  const range = params.range ?? 'all'
  const horizon = params.horizon ?? 3
  const { listFinancialMetricObservationHistory } = await import(
    '@/lib/financial-data/persistence'
  )
  const observations = await listFinancialMetricObservationHistory({
    userId: params.userId,
    metricKey: params.metricKey,
    limit: 100,
  })

  return summarizeMetricForecast({
    metricKey: params.metricKey,
    range,
    horizon,
    observations,
  })
}

export function isForecastHorizon(value: number): value is ForecastHorizon {
  return FORECAST_HORIZONS.includes(value as ForecastHorizon)
}

export { HISTORICAL_METRIC_KEYS }
