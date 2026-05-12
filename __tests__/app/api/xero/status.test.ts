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

function mockXeroConnectionQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)

  mockedCreateAdminSupabaseClient.mockReturnValue({
    from: jest.fn().mockReturnValue(query),
  } as unknown as ReturnType<typeof createAdminSupabaseClient>)

  return query
}

describe('/api/xero/status', () => {
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

  it('returns disconnected when the user has no Xero connection', async () => {
    mockXeroConnectionQuery({ data: null, error: null })

    const response = await GET({} as Parameters<typeof GET>[0])
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      success: true,
      data: { connected: false },
    })
  })

  it('returns tenant details when the user has a Xero connection', async () => {
    mockXeroConnectionQuery({
      data: {
        tenant_id: 'tenant-1',
        tenant_name: 'Demo Company NZ',
        connected_at: '2026-05-12T00:00:00.000Z',
        expires_at: '2026-05-12T01:00:00.000Z',
        updated_at: '2026-05-12T00:10:00.000Z',
      },
      error: null,
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
