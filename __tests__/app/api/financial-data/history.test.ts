/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/financial-data/history/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readFinancialMetricHistorySeries } from '@/lib/financial-data/metric-history'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/financial-data/metric-history', () => ({
  HISTORICAL_METRIC_KEYS: ['cash', 'monthly_revenue', 'monthly_expenses', 'burn_rate', 'runway_months'],
  METRIC_HISTORY_RECORD_LIMITS: [12, 25, 50, 'all'],
  readFinancialMetricHistorySeries: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockReadFinancialMetricHistorySeries = jest.mocked(readFinancialMetricHistorySeries)

describe('/api/financial-data/history', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
  })

  it('returns the authenticated user history for a valid query', async () => {
    mockReadFinancialMetricHistorySeries.mockResolvedValue({ metricKey: 'cash' } as never)

    const response = await GET(new NextRequest('http://localhost/api/financial-data/history?metricKey=cash&range=3m&currency=AUD&sourceKey=document%3Astatement-1&recordLimit=25'))

    expect(response.status).toBe(200)
    expect(mockReadFinancialMetricHistorySeries).toHaveBeenCalledWith({
      userId: 'user-1',
      metricKey: 'cash',
      range: '3m',
      currency: 'AUD',
      sourceKey: 'document:statement-1',
      recordLimit: 25,
    })
  })

  it('rejects invalid metric keys before querying data', async () => {
    const response = await GET(new NextRequest('http://localhost/api/financial-data/history?metricKey=unknown'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockReadFinancialMetricHistorySeries).not.toHaveBeenCalled()
  })

  it('rejects unsupported currency and record-limit filters', async () => {
    const invalidCurrency = await GET(new NextRequest('http://localhost/api/financial-data/history?metricKey=cash&currency=USD'))
    const invalidLimit = await GET(new NextRequest('http://localhost/api/financial-data/history?metricKey=cash&recordLimit=13'))

    expect(invalidCurrency.status).toBe(400)
    expect(invalidLimit.status).toBe(400)
    expect(mockReadFinancialMetricHistorySeries).not.toHaveBeenCalled()
  })
})
