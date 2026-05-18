/**
 * @jest-environment node
 */

import { GET } from '@/app/api/xero/status/route'
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

function createQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)

  return query
}

function mockSupabaseQueries(resultsByTable: Record<string, unknown>) {
  const from = jest.fn((table: string) => createQuery(resultsByTable[table]))

  mockedCreateAdminSupabaseClient.mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createAdminSupabaseClient>)

  return from
}

describe('/api/xero/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.XERO_DEMO_MODE
    mockedRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'owner@example.com',
      },
    })
  })

  it('returns demo connected status without reading Supabase in demo mode', async () => {
    process.env.XERO_DEMO_MODE = 'true'

    const response = await GET({} as Parameters<typeof GET>[0])
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockedCreateAdminSupabaseClient).not.toHaveBeenCalled()
    expect(payload.data).toMatchObject({
      connected: true,
      demo: true,
      tenantId: 'demo-xero-tenant',
      tenantName: 'Demo Company NZ',
      expiresAt: null,
    })
  })

  it('returns disconnected when the user has no data connection', async () => {
    mockSupabaseQueries({
      data_connections: { data: null, error: null },
    })

    const response = await GET({} as Parameters<typeof GET>[0])
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      success: true,
      data: { connected: false },
    })
  })

  it('returns disconnected when the data connection is not connected', async () => {
    mockSupabaseQueries({
      data_connections: {
        data: {
          id: 'connection-1',
          status: 'disconnected',
          connected_at: '2026-05-12T00:00:00.000Z',
        },
        error: null,
      },
    })

    const response = await GET({} as Parameters<typeof GET>[0])
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      success: true,
      data: { connected: false },
    })
  })

  it('returns tenant details when the user has a linked Xero connection', async () => {
    mockSupabaseQueries({
      data_connections: {
        data: {
          id: 'connection-1',
          status: 'connected',
          connected_at: '2026-05-12T00:00:00.000Z',
        },
        error: null,
      },
      xero_connections: {
        data: {
          tenant_id: 'tenant-1',
          tenant_name: 'Demo Company NZ',
          expires_at: '2026-05-12T01:00:00.000Z',
          updated_at: '2026-05-12T00:10:00.000Z',
        },
        error: null,
      },
    })

    const response = await GET({} as Parameters<typeof GET>[0])
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      success: true,
      data: {
        connected: true,
        tenantId: 'tenant-1',
        tenantName: 'Demo Company NZ',
        connectedAt: '2026-05-12T00:00:00.000Z',
        expiresAt: '2026-05-12T01:00:00.000Z',
        updatedAt: '2026-05-12T00:10:00.000Z',
      },
    })
  })
})
