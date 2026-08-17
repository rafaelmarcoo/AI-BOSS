/** @jest-environment node */

import { POST } from '@/app/api/auth/test-bypass/route'
import { applySessionCookies } from '@/lib/auth'
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase'

jest.mock('@/lib/auth', () => ({ applySessionCookies: jest.fn() }))
jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
  createServerSupabaseClient: jest.fn(),
}))

const mockedApplySessionCookies = jest.mocked(applySessionCookies)
const mockedCreateAdminSupabaseClient = jest.mocked(createAdminSupabaseClient)
const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient)
const maybeSingle = jest.fn()
const updateUserById = jest.fn()
const signInWithPassword = jest.fn()

describe('/api/auth/test-bypass', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    maybeSingle.mockResolvedValue({ data: { id: 'user-1' }, error: null })
    updateUserById.mockResolvedValue({ data: {}, error: null })
    signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
        },
        user: { id: 'user-1', email: 'person@example.com' },
      },
      error: null,
    })
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ maybeSingle })),
        })),
      })),
      auth: { admin: { updateUserById } },
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)
    mockedCreateServerSupabaseClient.mockReturnValue({
      auth: { signInWithPassword },
    } as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('confirms the test user and issues a session without sending email', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/test-bypass', {
        method: 'POST',
        body: JSON.stringify({
          email: 'person@example.com',
          password: 'password123',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(updateUserById).toHaveBeenCalledWith('user-1', {
      email_confirm: true,
    })
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'password123',
    })
    expect(mockedApplySessionCookies).toHaveBeenCalledWith(
      response,
      expect.objectContaining({ access_token: 'access-token' })
    )
  })
})
