/** @jest-environment node */

import { POST } from '@/app/api/auth/signup/route'
import { applySessionCookies } from '@/lib/auth'
import { findCompanyByJoinCode, findCompanyByName } from '@/lib/companies'
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase'

jest.mock('@/lib/companies', () => ({
  findCompanyByJoinCode: jest.fn(),
  findCompanyByName: jest.fn(),
}))
jest.mock('@/lib/auth', () => ({ applySessionCookies: jest.fn() }))
jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
  createServerSupabaseClient: jest.fn(),
}))

const mockedFindCompanyByJoinCode = jest.mocked(findCompanyByJoinCode)
const mockedFindCompanyByName = jest.mocked(findCompanyByName)
const mockedApplySessionCookies = jest.mocked(applySessionCookies)
const mockedCreateAdminSupabaseClient = jest.mocked(createAdminSupabaseClient)
const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient)
const signUp = jest.fn()
const signInWithPassword = jest.fn()
const createUser = jest.fn()
const upsert = jest.fn()
const deleteUser = jest.fn()

describe('/api/auth/signup company codes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedFindCompanyByName.mockResolvedValue(null)
    mockedFindCompanyByJoinCode.mockResolvedValue({
      id: 'company-1',
      name: 'Acme Ltd',
    })
    signUp.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          identities: [{ id: 'identity-1' }],
        },
        session: null,
      },
      error: null,
    })
    createUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'employee@example.com',
          identities: [{ id: 'identity-1' }],
        },
      },
      error: null,
    })
    signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'employee@example.com' },
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
        },
      },
      error: null,
    })
    upsert.mockResolvedValue({ error: null })
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({ upsert })),
      auth: { admin: { createUser, deleteUser } },
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)
    mockedCreateServerSupabaseClient.mockReturnValue({
      auth: { signUp, signInWithPassword },
    } as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('uses a valid stored code to assign the employee company', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: 'employee@example.com',
          password: 'password123',
          fullName: 'Employee One',
          userType: 'employee',
          companyCode: 'a3f97c21d84b6e10',
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(mockedFindCompanyByJoinCode).toHaveBeenCalledWith(
      'A3F9-7C21-D84B-6E10'
    )
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        company_name: 'Acme Ltd',
        user_type: 'employee',
      }),
      { onConflict: 'id' }
    )
  })

  it('rejects an invalid or expired code before creating an auth user', async () => {
    mockedFindCompanyByJoinCode.mockResolvedValue(null)

    const response = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: 'employee@example.com',
          password: 'password123',
          userType: 'employee',
          companyCode: 'A3F9-7C21-D84B-6E10',
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error.details.companyCode).toMatch(/current code/i)
    expect(signUp).not.toHaveBeenCalled()
  })

  it('creates a confirmed development account and session without sending email', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'x-ai-boss-test-bypass': 'true' },
        body: JSON.stringify({
          email: 'employee@example.com',
          password: 'password123',
          userType: 'employee',
          companyCode: 'A3F9-7C21-D84B-6E10',
        }),
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith({
      email: 'employee@example.com',
      password: 'password123',
      email_confirm: true,
    })
    expect(signUp).not.toHaveBeenCalled()
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'employee@example.com',
      password: 'password123',
    })
    expect(mockedApplySessionCookies).toHaveBeenCalledWith(
      response,
      expect.objectContaining({ access_token: 'access-token' })
    )
    expect(payload.data.nextStep).toBe('complete')
  })
})
