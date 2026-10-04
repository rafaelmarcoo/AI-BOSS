/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/financial-data/by-source/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listLatestFinancialMetricsBySource } from '@/lib/financial-data/persistence'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/financial-data/persistence', () => ({
  listLatestFinancialMetricsBySource: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockListLatestFinancialMetricsBySource = jest.mocked(
  listLatestFinancialMetricsBySource
)

describe('/api/financial-data/by-source', () => {
  it('reads confirmed values through the authenticated company service', async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'admin-1', email: 'admin@example.com' },
    })
    mockListLatestFinancialMetricsBySource.mockResolvedValue([])

    const response = await GET(
      new NextRequest('http://localhost/api/financial-data/by-source')
    )

    expect(response.status).toBe(200)
    expect(mockListLatestFinancialMetricsBySource).toHaveBeenCalledWith('admin-1')
  })
})
