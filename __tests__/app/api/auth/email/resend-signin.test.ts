/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/email/resend-signin/route'
import {
  applyPendingSignInCookie,
  getPendingSignInEmail,
} from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/auth', () => ({
  applyPendingSignInCookie: jest.fn(),
  getPendingSignInEmail: jest.fn(),
}))
jest.mock('@/lib/supabase', () => ({ createServerSupabaseClient: jest.fn() }))

const mockedApplyPendingSignInCookie = jest.mocked(applyPendingSignInCookie)
const mockedGetPendingSignInEmail = jest.mocked(getPendingSignInEmail)
const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient)
const signInWithOtp = jest.fn()

describe('/api/auth/email/resend-signin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedCreateServerSupabaseClient.mockReturnValue({
      auth: { signInWithOtp },
    } as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('resends while the password-verified cookie is valid', async () => {
    mockedGetPendingSignInEmail.mockReturnValue('person@example.com')
    signInWithOtp.mockResolvedValue({ data: {}, error: null })
    const request = new NextRequest('http://localhost/api/auth/email/resend-signin', {
      method: 'POST',
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
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

  it('does not send without recent password verification', async () => {
    mockedGetPendingSignInEmail.mockReturnValue(null)
    const request = new NextRequest('http://localhost/api/auth/email/resend-signin', {
      method: 'POST',
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(signInWithOtp).not.toHaveBeenCalled()
  })
})
