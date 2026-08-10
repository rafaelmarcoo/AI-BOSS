import { findCompanyName, getJoinableCompanyNames } from '@/lib/companies'
import { createAdminSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockedCreateAdminSupabaseClient =
  createAdminSupabaseClient as jest.MockedFunction<typeof createAdminSupabaseClient>

describe('company lookup', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns sorted, case-insensitively deduplicated admin companies', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      not: jest.fn(),
      order: jest.fn().mockResolvedValue({
        data: [
          { company_name: 'Zulu Ltd' },
          { company_name: 'Acme Ltd' },
          { company_name: 'acme ltd' },
          { company_name: null },
        ],
        error: null,
      }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.not.mockReturnValue(query)
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await expect(getJoinableCompanyNames()).resolves.toEqual(['Acme Ltd', 'Zulu Ltd'])
    expect(query.eq).toHaveBeenCalledWith('user_type', 'admin')
  })

  it('matches a requested company without changing stored spelling', () => {
    expect(findCompanyName(['Acme Ltd'], 'acme ltd')).toBe('Acme Ltd')
  })
})
