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
    for (const key of [
      'XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_REDIRECT_URI',
      'QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET', 'QUICKBOOKS_REDIRECT_URI',
      'FRESHBOOKS_CLIENT_ID', 'FRESHBOOKS_CLIENT_SECRET', 'FRESHBOOKS_REDIRECT_URI',
      'MYOB_CLIENT_ID', 'MYOB_CLIENT_SECRET', 'MYOB_REDIRECT_URI',
    ]) {
      process.env[key] = 'configured-for-test'
    }
    delete process.env.ZOHO_CLIENT_ID
    delete process.env.ZOHO_CLIENT_SECRET
    delete process.env.ZOHO_REDIRECT_URI
    delete process.env.FREEAGENT_CLIENT_ID
    delete process.env.FREEAGENT_CLIENT_SECRET
    delete process.env.FREEAGENT_REDIRECT_URI
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
      'zoho_books',
      'freeagent',
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
      {
        provider: 'zoho_books',
        status: 'unavailable',
        displayName: null,
        connectedAt: null,
        lastSyncedAt: null,
      },
      {
        provider: 'freeagent',
        status: 'unavailable',
        displayName: null,
        connectedAt: null,
        lastSyncedAt: null,
      },
    ])
  })
})
