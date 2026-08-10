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
          { name: 'Zulu Ltd' },
          { name: 'Acme Ltd' },
          { name: 'acme ltd' },
          { name: null },
        ],
        error: null,
      }),
    }
    query.select.mockReturnValue(query)
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await expect(getJoinableCompanyNames()).resolves.toEqual(['Acme Ltd', 'Zulu Ltd'])
    expect(query.select).toHaveBeenCalledWith('name')
  })

  it('matches a requested company without changing stored spelling', () => {
    expect(findCompanyName(['Acme Ltd'], 'acme ltd')).toBe('Acme Ltd')
  })
})
