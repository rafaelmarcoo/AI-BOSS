import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  HISTORICAL_METRIC_KEYS,
  readFinancialMetricHistory,
  type HistoricalMetricKey,
  type MetricHistoryRange,
} from '@/lib/financial-data/metric-history'

function isHistoryRange(value: string | null): value is MetricHistoryRange {
  return value === '3m' || value === '6m' || value === 'all'
}

function isHistoricalMetricKey(value: string | null): value is HistoricalMetricKey {
  return Boolean(value && HISTORICAL_METRIC_KEYS.includes(value as HistoricalMetricKey))
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const metricKey = request.nextUrl.searchParams.get('metricKey')
    const range = request.nextUrl.searchParams.get('range') ?? 'all'

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

    const history = await readFinancialMetricHistory({
      userId: user.id,
      metricKey,
      range,
    })

    return successResponse(history)
  } catch (error) {
    return handleRouteError(error)
  }
}
