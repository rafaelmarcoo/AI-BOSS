/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as listScenarios, POST as createScenario } from '@/app/api/scenarios/route'
import { DELETE, GET, PATCH } from '@/app/api/scenarios/[scenarioId]/route'
import { POST as duplicateScenario } from '@/app/api/scenarios/[scenarioId]/duplicate/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  createSavedScenario,
  deleteSavedScenario,
  duplicateSavedScenario,
  getSavedScenario,
  listSavedScenarios,
  updateSavedScenario,
} from '@/lib/scenarios/persistence'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/scenarios/persistence', () => ({
  createSavedScenario: jest.fn(), deleteSavedScenario: jest.fn(),
  duplicateSavedScenario: jest.fn(), getSavedScenario: jest.fn(),
  listSavedScenarios: jest.fn(), updateSavedScenario: jest.fn(),
}))

const mockAuth = jest.mocked(requireAuthenticatedUser)
const mocks = {
  create: jest.mocked(createSavedScenario), delete: jest.mocked(deleteSavedScenario),
  duplicate: jest.mocked(duplicateSavedScenario), get: jest.mocked(getSavedScenario),
  list: jest.mocked(listSavedScenarios), update: jest.mocked(updateSavedScenario),
}
const context = { params: Promise.resolve({ scenarioId: 'scenario-1' }) }

describe('saved scenario API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ accessToken: 'token', user: { id: 'user-1', email: 'owner@example.com' } })
  })

  it('lists and creates scenarios for the authenticated user', async () => {
    mocks.list.mockResolvedValue([])
    mocks.create.mockResolvedValue({ id: 'scenario-1' } as never)
    const listResponse = await listScenarios(new NextRequest('http://localhost/api/scenarios'))
    const createBody = { name: 'Plan', status: 'draft', visibility: 'private', input: {} }
    const createResponse = await createScenario(new NextRequest('http://localhost/api/scenarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createBody),
    }))
    expect(listResponse.status).toBe(200)
    expect(createResponse.status).toBe(201)
    expect(mocks.list).toHaveBeenCalledWith('user-1')
    expect(mocks.create).toHaveBeenCalledWith('user-1', createBody)
  })

  it('gets, updates, deletes, and duplicates through authorization-aware services', async () => {
    mocks.get.mockResolvedValue({ id: 'scenario-1' } as never)
    mocks.update.mockResolvedValue({ id: 'scenario-1' } as never)
    mocks.duplicate.mockResolvedValue({ id: 'scenario-copy' } as never)
    const request = new NextRequest('http://localhost/api/scenarios/scenario-1')
    const patchBody = { name: 'Updated' }
    expect((await GET(request, context)).status).toBe(200)
    expect((await PATCH(new NextRequest(request.url, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patchBody),
    }), context)).status).toBe(200)
    expect((await DELETE(new NextRequest(request.url, { method: 'DELETE' }), context)).status).toBe(200)
    expect((await duplicateScenario(new NextRequest(`${request.url}/duplicate`, { method: 'POST' }), context)).status).toBe(201)
    expect(mocks.get).toHaveBeenCalledWith('scenario-1', 'user-1')
    expect(mocks.update).toHaveBeenCalledWith('scenario-1', 'user-1', patchBody)
    expect(mocks.delete).toHaveBeenCalledWith('scenario-1', 'user-1')
    expect(mocks.duplicate).toHaveBeenCalledWith('scenario-1', 'user-1')
  })
})
