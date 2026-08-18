import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  FORECAST_HORIZONS,
  isForecastHorizon,
  readFinancialMetricForecastSeries,
  type ForecastHorizon,
} from '@/lib/financial-data/metric-forecast'
import {
  HISTORICAL_METRIC_KEYS,
  METRIC_HISTORY_RECORD_LIMITS,
  type HistoricalMetricKey,
  type MetricHistoryRecordLimit,
  type MetricHistoryRange,
} from '@/lib/financial-data/metric-history'
import { isSupportedFinancialCurrency } from '@/lib/financial-data/currency'

function isHistoryRange(value: string | null): value is MetricHistoryRange {
  return value === '3m' || value === '6m' || value === 'all'
}

function isHistoricalMetricKey(value: string | null): value is HistoricalMetricKey {
  return Boolean(value && HISTORICAL_METRIC_KEYS.includes(value as HistoricalMetricKey))
}

function parseForecastHorizon(value: string | null): ForecastHorizon | null {
  if (!value || !/^\d+$/.test(value)) return null
  const horizon = Number(value)
  return isForecastHorizon(horizon) ? horizon : null
}

function parseRecordLimit(value: string | null): MetricHistoryRecordLimit | null {
  if (!value) return 12
  if (value === 'all') return 'all'

  const parsed = Number(value)
  return METRIC_HISTORY_RECORD_LIMITS.includes(
    parsed as MetricHistoryRecordLimit
  )
    ? (parsed as MetricHistoryRecordLimit)
    : null
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const metricKey = request.nextUrl.searchParams.get('metricKey')
    const range = request.nextUrl.searchParams.get('range') ?? 'all'
    const horizon = parseForecastHorizon(request.nextUrl.searchParams.get('horizon') ?? '3')
    const currencyValue = request.nextUrl.searchParams.get('currency')
    const currency = currencyValue === 'all' || currencyValue === null
      ? null
      : currencyValue
    const sourceKey = request.nextUrl.searchParams.get('sourceKey')
    const recordLimit = parseRecordLimit(
      request.nextUrl.searchParams.get('recordLimit')
    )

    if (!isHistoricalMetricKey(metricKey)) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'metricKey must be cash, monthly_revenue, monthly_expenses, burn_rate, or runway_months.'
      )
    }

    if (!isHistoryRange(range)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'range must be 3m, 6m, or all.')
    }

    if (!horizon) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        `horizon must be one of: ${FORECAST_HORIZONS.join(', ')}.`
      )
    }

    if (currency !== null && !isSupportedFinancialCurrency(currency)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'currency must be NZD, AUD, or all.')
    }

    if (recordLimit === null) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'recordLimit must be 12, 25, 50, or all.')
    }

    if (sourceKey && sourceKey.length > 300) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'sourceKey is too long.')
    }

    const forecast = await readFinancialMetricForecastSeries({
      userId: user.id,
      metricKey,
      range,
      horizon,
      currency,
      sourceKey,
      recordLimit,
    })

    return successResponse(forecast)
  } catch (error) {
    return handleRouteError(error)
  }
}
