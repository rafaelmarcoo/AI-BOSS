/**
 * @jest-environment node
 */

import { GET } from '@/app/api/integrations/status/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

const mockedRequireAuthenticatedUser =
  requireAuthenticatedUser as jest.MockedFunction<typeof requireAuthenticatedUser>
const mockedCreateAdminSupabaseClient =
  createAdminSupabaseClient as jest.MockedFunction<typeof createAdminSupabaseClient>

function createStatusQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn().mockResolvedValue(result),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)

  return query
}

describe('/api/integrations/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'owner@example.com',
      },
    })
  })

  it('returns connected rows plus available defaults for supported providers', async () => {
    const query = createStatusQuery({
      data: [
        {
          provider: 'xero',
          status: 'connected',
          display_name: 'Demo Company NZ',
          connected_at: '2026-05-12T00:00:00.000Z',
          last_synced_at: '2026-05-12T00:10:00.000Z',
        },
      ],
      error: null,
    })
    const from = jest.fn().mockReturnValue(query)

    mockedCreateAdminSupabaseClient.mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    const response = await GET({} as Parameters<typeof GET>[0])
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(from).toHaveBeenCalledWith('data_connections')
    expect(query.in).toHaveBeenCalledWith('provider', [
      'xero',
      'quickbooks',
      'freshbooks',
      'myob',
    ])
    expect(payload.data).toEqual([
      {
        provider: 'xero',
        status: 'connected',
        displayName: 'Demo Company NZ',
        connectedAt: '2026-05-12T00:00:00.000Z',
        lastSyncedAt: '2026-05-12T00:10:00.000Z',
      },
      {
        provider: 'quickbooks',
        status: 'available',
        displayName: null,
        connectedAt: null,
        lastSyncedAt: null,
      },
      {
        provider: 'freshbooks',
        status: 'available',
        displayName: null,
        connectedAt: null,
        lastSyncedAt: null,
      },
      {
        provider: 'myob',
        status: 'available',
        displayName: null,
        connectedAt: null,
        lastSyncedAt: null,
      },
    ])
  })
})
