/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/financial-data/forecast/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readFinancialMetricForecast } from '@/lib/financial-data/metric-forecast'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/financial-data/metric-forecast', () => ({
  FORECAST_HORIZONS: [3, 6],
  isForecastHorizon: (value: number) => value === 3 || value === 6,
  readFinancialMetricForecast: jest.fn(),
}))
jest.mock('@/lib/financial-data/metric-history', () => ({
  HISTORICAL_METRIC_KEYS: ['cash', 'monthly_revenue', 'monthly_expenses', 'burn_rate', 'runway_months'],
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockReadFinancialMetricForecast = jest.mocked(readFinancialMetricForecast)

describe('/api/financial-data/forecast', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
  })

  it('returns the authenticated user forecast for a valid query', async () => {
    mockReadFinancialMetricForecast.mockResolvedValue({ metricKey: 'cash' } as never)

    const response = await GET(new NextRequest('http://localhost/api/financial-data/forecast?metricKey=cash&range=6m&horizon=6'))

    expect(response.status).toBe(200)
    expect(mockReadFinancialMetricForecast).toHaveBeenCalledWith({
      userId: 'user-1',
      metricKey: 'cash',
      range: '6m',
      horizon: 6,
    })
  })

  it('rejects invalid metric, range, and horizon values', async () => {
    const invalidMetric = await GET(new NextRequest('http://localhost/api/financial-data/forecast?metricKey=unknown'))
    const invalidRange = await GET(new NextRequest('http://localhost/api/financial-data/forecast?metricKey=cash&range=1y'))
    const invalidHorizon = await GET(new NextRequest('http://localhost/api/financial-data/forecast?metricKey=cash&horizon=12'))

    expect(invalidMetric.status).toBe(400)
    expect(invalidRange.status).toBe(400)
    expect(invalidHorizon.status).toBe(400)
    expect(mockReadFinancialMetricForecast).not.toHaveBeenCalled()
  })
})
