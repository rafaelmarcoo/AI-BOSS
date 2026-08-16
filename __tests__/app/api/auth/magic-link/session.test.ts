/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/magic-link/session/route'
import { applySessionCookies } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/auth', () => ({
  applySessionCookies: jest.fn(),
  getPendingSignInEmail: jest.fn(() => 'person@example.com'),
}))
jest.mock('@/lib/supabase', () => ({
  COOKIE_MAGIC_LINK_STATE: 'magic-link-state',
  createServerSupabaseClient: jest.fn(),
}))

const mockedApplySessionCookies = jest.mocked(applySessionCookies)
const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient)
const setSession = jest.fn()

describe('/api/auth/magic-link/session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedCreateServerSupabaseClient.mockReturnValue({
      auth: { setSession },
    } as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('exchanges tokens for app cookies when the account matches the requested email', async () => {
    const session = {
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
    }
    setSession.mockResolvedValue({
      data: {
        session,
        user: { id: 'user-1', email: 'person@example.com' },
      },
      error: null,
    })
    const request = new NextRequest('http://localhost/api/auth/magic-link/session', {
      method: 'POST',
      headers: {
        cookie: `magic-link-state=${Buffer.from('person@example.com').toString('base64url')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    })
    expect(mockedApplySessionCookies).toHaveBeenCalledWith(response, session)
  })

  it('rejects tokens for a different account', async () => {
    setSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        },
        user: { id: 'user-2', email: 'attacker@example.com' },
      },
      error: null,
    })
    const request = new NextRequest('http://localhost/api/auth/magic-link/session', {
      method: 'POST',
      headers: {
        cookie: `magic-link-state=${Buffer.from('person@example.com').toString('base64url')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(mockedApplySessionCookies).not.toHaveBeenCalled()
  })
})
