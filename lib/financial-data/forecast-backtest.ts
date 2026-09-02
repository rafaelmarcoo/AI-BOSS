import { isSupportedFinancialCurrency } from '@/lib/financial-data/currency'
import type { HistoricalMetricKey } from '@/lib/financial-data/metric-history'
import { summarizeMetricHistory } from '@/lib/financial-data/metric-history'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'

const DAYS_PER_MONTH = 30.4375
const DEFAULT_MINIMUM_TRAINING_POINTS = 3

export interface ForecastBacktestPoint {
  forecastOriginDate: string
  targetDate: string
  forecastValue: number
  actualValue: number
  absoluteError: number
  percentageError: number | null
}

export interface ForecastBacktestSeries {
  metricKey: HistoricalMetricKey
  sourceKey: string
  sourceLabel: string
  currency: 'NZD' | 'AUD' | null
  trainingPointCount: number
  testPointCount: number
  meanAbsoluteError: number
  meanAbsolutePercentageError: number | null
  points: ForecastBacktestPoint[]
  method: 'fixed_origin_date_aware_linear_trend'
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function parseDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function datedObservation(observation: AvailableFinancialMetricValue) {
  const date = observation.asOfDate ?? observation.periodEnd
  return date ? { observation, date: date.slice(0, 10) } : null
}

function sourceKey(observation: AvailableFinancialMetricValue) {
  const provenance = observation.provenance
  return provenance.sourceId
    ? `${provenance.sourceType}:${provenance.sourceId}`
    : `${provenance.sourceType}:label:${provenance.sourceLabel}`
}

function monthlySlope(points: Array<{ date: string; value: number }>) {
  const firstDate = parseDate(points[0].date).valueOf()
  const coordinates = points.map((point) => ({
    months:
      (parseDate(point.date).valueOf() - firstDate) /
      86_400_000 /
      DAYS_PER_MONTH,
    value: point.value,
  }))
  const meanMonths =
    coordinates.reduce((total, point) => total + point.months, 0) /
    coordinates.length
  const meanValue =
    coordinates.reduce((total, point) => total + point.value, 0) /
    coordinates.length
  const denominator = coordinates.reduce(
    (total, point) => total + (point.months - meanMonths) ** 2,
    0
  )
  if (denominator === 0) return null
  return (
    coordinates.reduce(
      (total, point) =>
        total + (point.months - meanMonths) * (point.value - meanValue),
      0
    ) / denominator
  )
}

export function backtestMetricForecasts(params: {
  metricKey: HistoricalMetricKey
  observations: AvailableFinancialMetricValue[]
  minimumTrainingPoints?: number
}): ForecastBacktestSeries[] {
  const minimumTrainingPoints =
    params.minimumTrainingPoints ?? DEFAULT_MINIMUM_TRAINING_POINTS
  const grouped = new Map<string, AvailableFinancialMetricValue[]>()

  for (const observation of params.observations) {
    if (observation.key !== params.metricKey) continue
    const dated = datedObservation(observation)
    if (!dated) continue
    const currency =
      params.metricKey === 'runway_months'
        ? null
        : isSupportedFinancialCurrency(observation.currency)
          ? observation.currency
          : null
    if (params.metricKey !== 'runway_months' && !currency) continue
    const key = `${sourceKey(observation)}:${currency ?? 'unitless'}`
    grouped.set(key, [...(grouped.get(key) ?? []), observation])
  }

  return [...grouped.entries()].flatMap(([groupKey, observations]) => {
    const history = summarizeMetricHistory({
      metricKey: params.metricKey,
      range: 'all',
      observations,
      recordLimit: 'all',
    })
    if (history.points.length <= minimumTrainingPoints) return []

    const training = history.points.slice(0, minimumTrainingPoints)
    const slope = monthlySlope(training)
    const origin = training.at(-1)
    if (slope === null || !origin) return []

    const originTime = parseDate(origin.date).valueOf()
    const points = history.points.slice(minimumTrainingPoints).map((actual) => {
      const months =
        (parseDate(actual.date).valueOf() - originTime) /
        86_400_000 /
        DAYS_PER_MONTH
      const rawForecast = origin.value + slope * months
      const forecastValue = round(
        params.metricKey === 'runway_months'
          ? Math.max(0, rawForecast)
          : rawForecast
      )
      const absoluteError = round(Math.abs(forecastValue - actual.value))
      return {
        forecastOriginDate: origin.date,
        targetDate: actual.date,
        forecastValue,
        actualValue: actual.value,
        absoluteError,
        percentageError:
          actual.value === 0
            ? null
            : round((absoluteError / Math.abs(actual.value)) * 100),
      }
    })
    const percentageErrors = points.flatMap((point) =>
      point.percentageError === null ? [] : [point.percentageError]
    )
    const first = observations[0]

    return [{
      metricKey: params.metricKey,
      sourceKey: groupKey.slice(0, groupKey.lastIndexOf(':')),
      sourceLabel: first.provenance.sourceLabel,
      currency: history.currency as 'NZD' | 'AUD' | null,
      trainingPointCount: training.length,
      testPointCount: points.length,
      meanAbsoluteError: round(
        points.reduce((total, point) => total + point.absoluteError, 0) /
          points.length
      ),
      meanAbsolutePercentageError:
        percentageErrors.length === 0
          ? null
          : round(
              percentageErrors.reduce((total, value) => total + value, 0) /
                percentageErrors.length
            ),
      points,
      method: 'fixed_origin_date_aware_linear_trend' as const,
    }]
  }).sort((left, right) =>
    left.sourceLabel.localeCompare(right.sourceLabel) ||
    (left.currency ?? '').localeCompare(right.currency ?? '')
  )
}
