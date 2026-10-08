import { copyCompanyForUser } from '@/lib/company-analysis/persistence'
import type { AnalysedCompany } from '@/types/database'
import { fakeDatabase, type Operation, type Result } from '@/test-support/fake-supabase'

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

const ressett: AnalysedCompany = {
  id: 'ressett-id',
  user_id: null,
  name: 'Ressett',
  industry: 'PC reselling',
  peer_group: 'lamland-pc-resellers',
  currency: 'L$',
  amounts_in: 'millions',
  description: 'A PC reseller',
  source: 'CIMA pre-seen material',
  created_at: '2026-09-25T00:00:00.000Z',
  updated_at: '2026-09-25T00:00:00.000Z',
}
const savedLines = [
  { id: 'l1', company_id: 'ressett-id', fiscal_year_end: '2025-03-31', line_key: 'revenue', segment: '', value: 203.3, source_page: 17, created_at: '', updated_at: '' },
  { id: 'l2', company_id: 'ressett-id', fiscal_year_end: '2025-03-31', line_key: 'cost_of_sales', segment: '', value: 146.4, source_page: 17, created_at: '', updated_at: '' },
]

function database(visible: AnalysedCompany[], override: (operation: Operation) => Result | undefined = () => undefined) {
  return fakeDatabase((operation) => {
    const result = override(operation)
    if (result) return result
    if (operation.table === 'analysed_companies' && operation.action === 'select') return { data: visible }
    if (operation.table === 'analysed_companies' && operation.action === 'insert') {
      return { data: { ...ressett, ...(operation.payload as object), id: 'copy-id' } }
    }
    if (operation.table === 'company_statement_lines' && operation.action === 'select') return { data: savedLines }
    return { data: null }
  })
}

const inserted = (operations: Operation[], table: string) =>
  operations.filter((operation) => operation.table === table && operation.action === 'insert')

describe('copyCompanyForUser', () => {
  beforeEach(() => jest.clearAllMocks())

  it("makes the user's own copy in the same competitor group, with every figure and page", async () => {
    const operations = database([ressett])
    const copy = await copyCompanyForUser('user-1', 'ressett-id')

    expect(copy.name).toBe('Ressett (copy)')
    expect(inserted(operations, 'analysed_companies')[0].payload).toMatchObject({
      user_id: 'user-1',
      name: 'Ressett (copy)',
      peer_group: 'lamland-pc-resellers',
      currency: 'L$',
      amounts_in: 'millions',
      source: 'Your copy of Ressett (CIMA pre-seen material)',
    })
    expect(inserted(operations, 'company_statement_lines')[0].payload).toEqual([
      { company_id: 'copy-id', fiscal_year_end: '2025-03-31', line_key: 'revenue', segment: '', value: 203.3, source_page: 17 },
      { company_id: 'copy-id', fiscal_year_end: '2025-03-31', line_key: 'cost_of_sales', segment: '', value: 146.4, source_page: 17 },
    ])
  })

  it('numbers further copies so names never clash', async () => {
    const existing = { ...ressett, id: 'first-copy', user_id: 'user-1', name: 'Ressett (copy)' }
    database([ressett, existing])

    expect((await copyCompanyForUser('user-1', 'ressett-id')).name).toBe('Ressett (copy 2)')
  })

  it('removes the half-made copy if the figures fail to copy', async () => {
    const operations = database([ressett], (operation) =>
      operation.table === 'company_statement_lines' && operation.action === 'insert'
        ? { error: { message: 'insert failed' } }
        : undefined
    )

    await expect(copyCompanyForUser('user-1', 'ressett-id')).rejects.toMatchObject({ status: 500 })
    const deletes = operations.filter((operation) => operation.table === 'analysed_companies' && operation.action === 'delete')
    expect(deletes).toHaveLength(1)
    expect(deletes[0].filters).toEqual([['id', 'copy-id'], ['user_id', 'user-1']])
  })

  it("refuses a company the user can't see, before writing anything", async () => {
    const operations = database([])

    await expect(copyCompanyForUser('user-1', 'ressett-id')).rejects.toMatchObject({ status: 404 })
    expect(operations.filter((operation) => operation.action !== 'select')).toEqual([])
  })
})
