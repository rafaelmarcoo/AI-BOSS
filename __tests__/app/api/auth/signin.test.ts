/** @jest-environment node */

import { POST } from '@/app/api/auth/signin/route'
import { applyPendingSignInCookie } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/auth', () => ({ applyPendingSignInCookie: jest.fn() }))
jest.mock('@/lib/supabase', () => ({
  COOKIE_MAGIC_LINK_STATE: 'magic-link-state',
  createServerSupabaseClient: jest.fn(),
}))

const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient)
const mockedApplyPendingSignInCookie = jest.mocked(applyPendingSignInCookie)
const signInWithPassword = jest.fn()
const signOut = jest.fn()
const signInWithOtp = jest.fn()

describe('/api/auth/signin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedCreateServerSupabaseClient.mockReturnValue({
      auth: { signInWithPassword, signOut, signInWithOtp },
    } as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('verifies the password, then sends a link without creating a new user', async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'password-session' },
        user: { id: 'user-1', email: 'person@example.com' },
      },
      error: null,
    })
    signOut.mockResolvedValue({ error: null })
    signInWithOtp.mockResolvedValue({ data: {}, error: null })

    const response = await POST(
      new Request('http://localhost/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: 'person@example.com',
          password: 'password123',
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.nextStep).toBe('check-email')
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'password123',
    })
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'person@example.com',
      options: {
        shouldCreateUser: false,
        emailRedirectTo: 'http://localhost/auth/callback?flow=signin',
      },
    })
    expect(mockedApplyPendingSignInCookie).toHaveBeenCalledWith(
      response,
      'person@example.com'
    )
  })
})
