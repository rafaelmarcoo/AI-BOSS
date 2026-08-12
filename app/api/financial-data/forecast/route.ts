import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  FORECAST_HORIZONS,
  isForecastHorizon,
  readFinancialMetricForecast,
  type ForecastHorizon,
} from '@/lib/financial-data/metric-forecast'
import {
  HISTORICAL_METRIC_KEYS,
  type HistoricalMetricKey,
  type MetricHistoryRange,
} from '@/lib/financial-data/metric-history'

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

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const metricKey = request.nextUrl.searchParams.get('metricKey')
    const range = request.nextUrl.searchParams.get('range') ?? 'all'
    const horizon = parseForecastHorizon(request.nextUrl.searchParams.get('horizon') ?? '3')

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

    const forecast = await readFinancialMetricForecast({
      userId: user.id,
      metricKey,
      range,
      horizon,
    })

    return successResponse(forecast)
  } catch (error) {
    return handleRouteError(error)
  }
}
