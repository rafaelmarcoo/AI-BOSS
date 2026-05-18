/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/xero/callback/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { encryptToken } from '@/lib/xero/crypto'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@/lib/xero/crypto', () => ({
  encryptToken: jest.fn(),
}))

describe('/api/xero/callback', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalClientId = process.env.XERO_CLIENT_ID
  const originalClientSecret = process.env.XERO_CLIENT_SECRET
  const originalRedirectUri = process.env.XERO_REDIRECT_URI

  const mockedRequireAuthenticatedUser =
    requireAuthenticatedUser as jest.MockedFunction<typeof requireAuthenticatedUser>
  const mockedCreateAdminSupabaseClient =
    createAdminSupabaseClient as jest.MockedFunction<typeof createAdminSupabaseClient>
  const mockedEncryptToken = encryptToken as jest.MockedFunction<typeof encryptToken>

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    process.env.XERO_CLIENT_ID = originalClientId
    process.env.XERO_CLIENT_SECRET = originalClientSecret
    process.env.XERO_REDIRECT_URI = originalRedirectUri
    jest.clearAllMocks()
  })

  it('redirects back to the dashboard origin even when NEXT_PUBLIC_APP_URL contains a path', async () => {
    process.env.NEXT_PUBLIC_APP_URL =
      'https://ai-boss-nine.vercel.app/api/xero/callback'

    const request = new NextRequest(
      'https://ai-boss-nine.vercel.app/api/xero/callback?error=access_denied'
    )

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://ai-boss-nine.vercel.app/dashboard?xero=error'
    )
  })

  it('stores connected Xero credentials in oauth_tokens', async () => {
    process.env.XERO_CLIENT_ID = 'client-id'
    process.env.XERO_CLIENT_SECRET = 'client-secret'
    process.env.XERO_REDIRECT_URI = 'http://localhost:3000/api/xero/callback'
    mockedRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'access-token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
    mockedEncryptToken.mockImplementation(async (value) => `encrypted:${value}`)
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'xero-access',
          refresh_token: 'xero-refresh',
          expires_in: 1800,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ tenantId: 'tenant-1', tenantName: 'Demo Company NZ' }],
      }) as jest.Mock

    const stateQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { state: 'state-1' }, error: null }),
    }
    const stateDelete = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }
    const dataConnectionUpsert = {
      upsert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'connection-1' }, error: null }),
    }
    const oauthTokenUpsert = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    }
    const from = jest
      .fn()
      .mockReturnValueOnce(stateQuery)
      .mockReturnValueOnce(stateDelete)
      .mockReturnValueOnce(dataConnectionUpsert)
      .mockReturnValueOnce(oauthTokenUpsert)

    mockedCreateAdminSupabaseClient.mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    const request = new NextRequest(
      'http://localhost:3000/api/xero/callback?code=code-1&state=state-1'
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/dashboard?xero=connected'
    )
    expect(from).toHaveBeenNthCalledWith(4, 'oauth_tokens')
    expect(oauthTokenUpsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        connection_id: 'connection-1',
        user_id: 'user-1',
        provider: 'xero',
        tenant_id: 'tenant-1',
        tenant_name: 'Demo Company NZ',
        access_token_enc: 'encrypted:xero-access',
        refresh_token_enc: 'encrypted:xero-refresh',
      }),
      { onConflict: 'user_id,provider' }
    )
  })
})
