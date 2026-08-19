/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as getBaselines } from '@/app/api/scenarios/baselines/route'
import { POST as analyse } from '@/app/api/scenarios/analyse/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { analyseScenario, listScenarioBaselineOptions } from '@/lib/scenarios/service'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/scenarios/service', () => ({
  analyseScenario: jest.fn(),
  listScenarioBaselineOptions: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockAnalyseScenario = jest.mocked(analyseScenario)
const mockListBaselines = jest.mocked(listScenarioBaselineOptions)

describe('scenario core API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
  })

  it('returns only baseline choices loaded for the authenticated user', async () => {
    mockListBaselines.mockResolvedValue([{ sourceKey: 'document:doc-1' }] as never)
    const response = await getBaselines(new NextRequest('http://localhost/api/scenarios/baselines'))
    expect(response.status).toBe(200)
    expect(mockListBaselines).toHaveBeenCalledWith('user-1')
  })

  it('passes the authenticated user and structured input to the shared analysis service', async () => {
    const body = { sourceKey: 'document:doc-1', currency: 'NZD' }
    mockAnalyseScenario.mockResolvedValue({ sourceKey: 'document:doc-1' } as never)
    const response = await analyse(new NextRequest('http://localhost/api/scenarios/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))
    expect(response.status).toBe(200)
    expect(mockAnalyseScenario).toHaveBeenCalledWith('user-1', body)
  })

  it('returns a client error for deterministic validation failures', async () => {
    mockAnalyseScenario.mockRejectedValue(new Error('Cash is required.'))
    const response = await analyse(new NextRequest('http://localhost/api/scenarios/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { message: 'Cash is required.' },
    })
  })
})
