/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/financial-data/history/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readFinancialMetricHistory } from '@/lib/financial-data/metric-history'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/financial-data/metric-history', () => ({
  HISTORICAL_METRIC_KEYS: ['cash', 'monthly_revenue', 'monthly_expenses', 'burn_rate', 'runway_months'],
  readFinancialMetricHistory: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockReadFinancialMetricHistory = jest.mocked(readFinancialMetricHistory)

describe('/api/financial-data/history', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
  })

  it('returns the authenticated user history for a valid query', async () => {
    mockReadFinancialMetricHistory.mockResolvedValue({ metricKey: 'cash' } as never)

    const response = await GET(new NextRequest('http://localhost/api/financial-data/history?metricKey=cash&range=3m'))

    expect(response.status).toBe(200)
    expect(mockReadFinancialMetricHistory).toHaveBeenCalledWith({
      userId: 'user-1',
      metricKey: 'cash',
      range: '3m',
    })
  })

  it('rejects invalid metric keys before querying data', async () => {
    const response = await GET(new NextRequest('http://localhost/api/financial-data/history?metricKey=unknown'))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockReadFinancialMetricHistory).not.toHaveBeenCalled()
  })
})
