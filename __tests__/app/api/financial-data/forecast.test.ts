/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/financial-data/forecast/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readFinancialMetricForecastSeries } from '@/lib/financial-data/metric-forecast'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/financial-data/metric-forecast', () => ({
  FORECAST_HORIZONS: [3, 6],
  isForecastHorizon: (value: number) => value === 3 || value === 6,
  readFinancialMetricForecastSeries: jest.fn(),
}))
jest.mock('@/lib/financial-data/metric-history', () => ({
  HISTORICAL_METRIC_KEYS: ['cash', 'monthly_revenue', 'monthly_expenses', 'burn_rate', 'runway_months'],
  METRIC_HISTORY_RECORD_LIMITS: [12, 25, 50, 'all'],
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockReadFinancialMetricForecastSeries = jest.mocked(readFinancialMetricForecastSeries)

describe('/api/financial-data/forecast', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
  })

  it('returns the authenticated user forecast for a valid query', async () => {
    mockReadFinancialMetricForecastSeries.mockResolvedValue({ metricKey: 'cash' } as never)

    const response = await GET(new NextRequest('http://localhost/api/financial-data/forecast?metricKey=cash&range=6m&horizon=6&currency=NZD&sourceKey=document%3Astatement-1&recordLimit=all'))

    expect(response.status).toBe(200)
    expect(mockReadFinancialMetricForecastSeries).toHaveBeenCalledWith({
      userId: 'user-1',
      metricKey: 'cash',
      range: '6m',
      horizon: 6,
      currency: 'NZD',
      sourceKey: 'document:statement-1',
      recordLimit: 'all',
    })
  })

  it('rejects invalid metric, range, and horizon values', async () => {
    const invalidMetric = await GET(new NextRequest('http://localhost/api/financial-data/forecast?metricKey=unknown'))
    const invalidRange = await GET(new NextRequest('http://localhost/api/financial-data/forecast?metricKey=cash&range=1y'))
    const invalidHorizon = await GET(new NextRequest('http://localhost/api/financial-data/forecast?metricKey=cash&horizon=12'))

    expect(invalidMetric.status).toBe(400)
    expect(invalidRange.status).toBe(400)
    expect(invalidHorizon.status).toBe(400)
    expect(mockReadFinancialMetricForecastSeries).not.toHaveBeenCalled()
  })
})
