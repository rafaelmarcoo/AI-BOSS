import { requireCompanyAdmin } from '@/lib/companies'
import { saveAccountingSnapshot } from '@/lib/integrations/sync'
import { createAdminSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/companies', () => ({
  requireCompanyAdmin: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@/lib/financial-data/reporting/persistence', () => ({
  saveAccountingReadModels: jest.fn(),
}))

describe('accounting snapshot synchronization', () => {
  it.each(['USD', 'GBP', ''])('rejects unsupported %s currency before any database access', async (currency) => {
    await expect(
      saveAccountingSnapshot({
        userId: 'user-1',
        connectionId: 'connection-1',
        provider: 'zoho_books',
        sourceLabel: 'Example Books',
        snapshot: {
          cashBalance: 1,
          accountsReceivable: 2,
          accountsPayable: 3,
          monthlyRevenue: 4,
          monthlyExpenses: 5,
          currency,
          asOf: '2026-10-05',
          raw: {},
        },
      })
    ).rejects.toThrow('currently supports NZD and AUD')

    expect(requireCompanyAdmin).not.toHaveBeenCalled()
    expect(createAdminSupabaseClient).not.toHaveBeenCalled()
  })
})
