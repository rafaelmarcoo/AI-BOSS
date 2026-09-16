import {
  findCompanyByJoinCode,
  findCompanyByName,
  getCompanyJoinCodeForAdmin,
} from '@/lib/companies'
import { createAdminSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockedCreateAdminSupabaseClient = jest.mocked(createAdminSupabaseClient)

describe('company lookup', () => {
  beforeEach(() => jest.clearAllMocks())

  it('matches an admin company name without exposing a company list', async () => {
    const select = jest.fn().mockResolvedValue({
      data: [
        { id: 'company-1', name: 'Acme Ltd' },
        { id: 'company-2', name: 'Zulu Ltd' },
      ],
      error: null,
    })
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({ select })),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await expect(findCompanyByName(' acme ltd ')).resolves.toEqual({
      id: 'company-1',
      name: 'Acme Ltd',
    })
  })

  it('resolves a company only from an unexpired stored join code', async () => {
    const codeMaybeSingle = jest.fn().mockResolvedValue({
      data: { company_id: 'company-1' },
      error: null,
    })
    const companyMaybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'company-1', name: 'Acme Ltd' },
      error: null,
    })
    const from = jest.fn((table: string) => {
      if (table === 'company_join_codes') {
        const query = {
          select: jest.fn(),
          eq: jest.fn(),
          gt: jest.fn(),
          maybeSingle: codeMaybeSingle,
        }
        query.select.mockReturnValue(query)
        query.eq.mockReturnValue(query)
        query.gt.mockReturnValue(query)
        return query
      }

      const query = {
        select: jest.fn(),
        eq: jest.fn(),
        maybeSingle: companyMaybeSingle,
      }
      query.select.mockReturnValue(query)
      query.eq.mockReturnValue(query)
      return query
    })
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await expect(
      findCompanyByJoinCode('A3F9-7C21-D84B-6E10')
    ).resolves.toEqual({ id: 'company-1', name: 'Acme Ltd' })
    expect(codeMaybeSingle).toHaveBeenCalled()
  })

  it('returns the stored join code to an admin in that company', async () => {
    const profileSingle = jest.fn().mockResolvedValue({
      data: { company_name: 'Acme Ltd', user_type: 'admin' },
      error: null,
    })
    const companySelect = jest.fn().mockResolvedValue({
      data: [{ id: 'company-1', name: 'Acme Ltd' }],
      error: null,
    })
    const codeMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        join_code: 'A3F9-7C21-D84B-6E10',
        expires_at: '2026-08-18T00:00:00.000Z',
      },
      error: null,
    })
    const from = jest.fn((table: string) => {
      if (table === 'users') {
        const query = { select: jest.fn(), eq: jest.fn(), single: profileSingle }
        query.select.mockReturnValue(query)
        query.eq.mockReturnValue(query)
        return query
      }
      if (table === 'companies') return { select: companySelect }

      const query = {
        select: jest.fn(),
        eq: jest.fn(),
        gt: jest.fn(),
        maybeSingle: codeMaybeSingle,
      }
      query.select.mockReturnValue(query)
      query.eq.mockReturnValue(query)
      query.gt.mockReturnValue(query)
      return query
    })
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await expect(getCompanyJoinCodeForAdmin('user-1')).resolves.toEqual({
      code: 'A3F9-7C21-D84B-6E10',
      expiresAt: '2026-08-18T00:00:00.000Z',
    })
  })

  it('does not return the join code to an employee', async () => {
    const profileSingle = jest.fn().mockResolvedValue({
      data: { company_name: 'Acme Ltd', user_type: 'employee' },
      error: null,
    })
    const companySelect = jest.fn().mockResolvedValue({
      data: [{ id: 'company-1', name: 'Acme Ltd' }],
      error: null,
    })
    const from = jest.fn((table: string) => {
      if (table === 'users') {
        const query = { select: jest.fn(), eq: jest.fn(), single: profileSingle }
        query.select.mockReturnValue(query)
        query.eq.mockReturnValue(query)
        return query
      }
      return { select: companySelect }
    })
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await expect(getCompanyJoinCodeForAdmin('user-1')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })
})
