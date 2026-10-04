/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/settings/dashboard-layouts/route'
import {
  DELETE,
  PATCH,
} from '@/app/api/settings/dashboard-layouts/[layoutId]/route'
import { POST as HYDRATE } from '@/app/api/settings/dashboard-layouts/hydrate/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  createDashboardLayout,
  deleteDashboardLayout,
  listDashboardLayouts,
  updateDashboardLayout,
} from '@/lib/gen-ui/dashboard-layout-persistence'
import { hydrateDashboardLayout } from '@/lib/gen-ui/dashboard-layout-hydration'
import {
  DASHBOARD_LAYOUT_VERSION,
  DEFAULT_DASHBOARD_RISK_THRESHOLDS,
  type DashboardLayoutPayload,
  type SavedDashboardLayout,
} from '@/lib/gen-ui/dashboard-layout-types'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/gen-ui/dashboard-layout-persistence', () => ({
  createDashboardLayout: jest.fn(),
  deleteDashboardLayout: jest.fn(),
  listDashboardLayouts: jest.fn(),
  updateDashboardLayout: jest.fn(),
}))
jest.mock('@/lib/gen-ui/dashboard-layout-hydration', () => ({
  hydrateDashboardLayout: jest.fn(),
}))

const mockAuth = jest.mocked(requireAuthenticatedUser)
const mockCreate = jest.mocked(createDashboardLayout)
const mockDelete = jest.mocked(deleteDashboardLayout)
const mockList = jest.mocked(listDashboardLayouts)
const mockUpdate = jest.mocked(updateDashboardLayout)
const mockHydrate = jest.mocked(hydrateDashboardLayout)

const payload: DashboardLayoutPayload = {
  version: DASHBOARD_LAYOUT_VERSION,
  widgets: [],
  riskThresholds: { ...DEFAULT_DASHBOARD_RISK_THRESHOLDS },
}
const saved: SavedDashboardLayout = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Owner view',
  isDefault: true,
  sourcePlanVersion: 1,
  sourceGeneratedAt: '2026-09-30T00:00:00.000Z',
  payload,
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
}

describe('dashboard layout API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
    mockList.mockResolvedValue([saved])
    mockCreate.mockResolvedValue(saved)
    mockUpdate.mockResolvedValue(saved)
    mockDelete.mockResolvedValue(undefined)
    mockHydrate.mockResolvedValue({ items: [], availableCurrencies: ['NZD'] })
  })

  it('lists and creates layouts only for the authenticated owner', async () => {
    const listResponse = await GET(
      new NextRequest('http://localhost/api/settings/dashboard-layouts'),
    )
    expect(listResponse.status).toBe(200)
    expect(mockList).toHaveBeenCalledWith('user-1')

    const input = {
      name: 'Owner view',
      isDefault: true,
      sourcePlanVersion: 1,
      sourceGeneratedAt: '2026-09-30T00:00:00.000Z',
      payload,
    }
    const createResponse = await POST(
      new NextRequest('http://localhost/api/settings/dashboard-layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
    expect(createResponse.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith('user-1', input)
  })

  it('updates, deletes, and hydrates the authenticated user layout', async () => {
    const context = { params: Promise.resolve({ layoutId: saved.id }) }
    const patchResponse = await PATCH(
      new NextRequest(`http://localhost/api/settings/dashboard-layouts/${saved.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Finance view' }),
      }),
      context,
    )
    expect(patchResponse.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('user-1', saved.id, {
      name: 'Finance view',
    })

    const hydrateResponse = await HYDRATE(
      new NextRequest('http://localhost/api/settings/dashboard-layouts/hydrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      }),
    )
    expect(hydrateResponse.status).toBe(200)
    expect(mockHydrate).toHaveBeenCalledWith('user-1', payload)

    const deleteResponse = await DELETE(
      new NextRequest(`http://localhost/api/settings/dashboard-layouts/${saved.id}`, {
        method: 'DELETE',
      }),
      context,
    )
    expect(deleteResponse.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('user-1', saved.id)
  })

  it('rejects invalid layouts before persistence', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/settings/dashboard-layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', isDefault: false, payload }),
      }),
    )
    expect(response.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
