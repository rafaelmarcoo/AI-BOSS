import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import type { CompanyDetails } from '@/lib/company-analysis/company-details'
import { updateUserCompany } from '@/lib/company-analysis/persistence'
import { linesFromStatements, statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { AnalysedCompany } from '@/types/database'

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

interface Operation {
  table: string
  action: 'select' | 'insert' | 'update' | 'delete'
  payload?: unknown
  filters: Array<[string, unknown]>
}

type Result = { data?: unknown; error?: { code?: string; message: string } | null }

function fakeDatabase(respond: (operation: Operation, operations: Operation[]) => Result) {
  const operations: Operation[] = []
  const client = {
    from(table: string) {
      const operation: Operation = { table, action: 'select', filters: [] }
      const builder = {
        select: () => builder,
        or: () => builder,
        order: () => builder,
        single: () => builder,
        eq: (column: string, value: unknown) => {
          operation.filters.push([column, value])
          return builder
        },
        insert: (payload: unknown) => Object.assign(operation, { action: 'insert', payload }) && builder,
        update: (payload: unknown) => Object.assign(operation, { action: 'update', payload }) && builder,
        delete: () => Object.assign(operation, { action: 'delete' }) && builder,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          operations.push(operation)
          const result = respond(operation, operations)
          return Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
  jest.mocked(createAdminSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminSupabaseClient>)
  return operations
}

const companyId = '0b8f3a52-6a3e-4c1b-9d7e-2f4a5b6c7d8e'
const kiwi: AnalysedCompany = {
  id: companyId,
  user_id: 'user-1',
  name: 'Kiwi Salons',
  industry: null,
  peer_group: 'user-group',
  currency: 'D$',
  amounts_in: 'millions',
  description: null,
  source: 'Uploaded by you: old.csv',
  created_at: '2026-10-02T00:00:00.000Z',
  updated_at: '2026-10-02T00:00:00.000Z',
}
const trimayr = statementsFromCaseStudy(CIMA_CASE_STUDIES.find((study) => study.name === 'Trimayr')!)
const ressett = statementsFromCaseStudy(CIMA_CASE_STUDIES.find((study) => study.name === 'Ressett')!)
const oldLines = linesFromStatements(trimayr.years).map((line, index) => ({
  ...line,
  id: `old-${index}`,
  company_id: companyId,
  created_at: '2026-10-02T00:00:00.000Z',
  updated_at: '2026-10-02T00:00:00.000Z',
}))
const details: CompanyDetails = {
  name: 'Kiwi Salons',
  industry: 'Hairdressing',
  currency: 'D$',
  amountsIn: 'millions',
  competitorOf: null,
  confirmedChecks: false,
}

function normalDatabase(overrides: (operation: Operation, inserts: number) => Result | undefined = () => undefined) {
  return fakeDatabase((operation, operations) => {
    const inserts = operations.filter((done) => done.table === 'company_statement_lines' && done.action === 'insert').length
    const override = overrides(operation, inserts)
    if (override) return override
    if (operation.table === 'analysed_companies' && operation.action === 'select') return { data: [kiwi] }
    if (operation.table === 'analysed_companies' && operation.action === 'update') {
      return { data: { ...kiwi, ...(operation.payload as object) } }
    }
    if (operation.table === 'company_statement_lines' && operation.action === 'select') return { data: oldLines }
    return { data: null }
  })
}

const linesTable = (operations: Operation[]) => operations.filter((operation) => operation.table === 'company_statement_lines')

describe('updateUserCompany', () => {
  beforeEach(() => jest.clearAllMocks())

  it('changes only the details when no file was uploaded', async () => {
    const operations = normalDatabase()
    const company = await updateUserCompany({ userId: 'user-1', companyId, details, years: null, fileName: null })

    expect(company.industry).toBe('Hairdressing')
    expect(linesTable(operations)).toEqual([])
  })

  it('replaces the figures and names the new file as the source', async () => {
    const operations = normalDatabase()
    const company = await updateUserCompany({ userId: 'user-1', companyId, details, years: ressett.years, fileName: 'new.csv' })

    const inserts = linesTable(operations).filter((operation) => operation.action === 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].payload).toEqual(linesFromStatements(ressett.years).map((row) => ({ ...row, company_id: companyId })))
    expect(company.source).toBe('Uploaded by you: new.csv')
  })

  it('puts the old figures back when the new ones fail to save', async () => {
    const operations = normalDatabase((operation, inserts) =>
      operation.table === 'company_statement_lines' && operation.action === 'insert' && inserts === 1
        ? { error: { message: 'insert failed' } }
        : undefined
    )

    await expect(
      updateUserCompany({ userId: 'user-1', companyId, details, years: ressett.years, fileName: 'new.csv' })
    ).rejects.toMatchObject({ status: 500, message: expect.stringContaining('old ones were kept') })

    const inserts = linesTable(operations).filter((operation) => operation.action === 'insert')
    expect(inserts).toHaveLength(2)
    expect(inserts[1].payload).toEqual(
      oldLines.map(({ company_id, fiscal_year_end, line_key, segment, value, source_page }) => ({
        company_id, fiscal_year_end, line_key, segment, value, source_page,
      }))
    )
    const sourceUpdates = operations.filter(
      (operation) => operation.action === 'update' && (operation.payload as { source?: string }).source
    )
    expect(sourceUpdates).toEqual([])
  })

  it('says so plainly if the old figures cannot be put back either', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    normalDatabase((operation) =>
      operation.table === 'company_statement_lines' && operation.action === 'insert'
        ? { error: { message: 'insert failed' } }
        : undefined
    )

    await expect(
      updateUserCompany({ userId: 'user-1', companyId, details, years: ressett.years, fileName: 'new.csv' })
    ).rejects.toMatchObject({ message: expect.stringContaining('could not be put back') })
  })

  it('touches nothing when the old figures cannot be cleared', async () => {
    const operations = normalDatabase((operation) =>
      operation.table === 'company_statement_lines' && operation.action === 'delete'
        ? { error: { message: 'delete failed' } }
        : undefined
    )

    await expect(
      updateUserCompany({ userId: 'user-1', companyId, details, years: ressett.years, fileName: 'new.csv' })
    ).rejects.toMatchObject({ message: expect.stringContaining('old ones were kept') })
    expect(linesTable(operations).filter((operation) => operation.action === 'insert')).toEqual([])
  })

  it("refuses a company the user didn't add, before changing anything", async () => {
    const operations = fakeDatabase((operation) =>
      operation.action === 'select' ? { data: [{ ...kiwi, user_id: null }] } : { data: null }
    )

    await expect(
      updateUserCompany({ userId: 'user-1', companyId, details, years: null, fileName: null })
    ).rejects.toMatchObject({ status: 404 })
    expect(operations.filter((operation) => operation.action !== 'select')).toEqual([])
  })

  it('reports a name clash from the database before touching the figures', async () => {
    const operations = normalDatabase((operation) =>
      operation.table === 'analysed_companies' && operation.action === 'update'
        ? { error: { code: '23505', message: 'duplicate' } }
        : undefined
    )

    await expect(
      updateUserCompany({ userId: 'user-1', companyId, details, years: ressett.years, fileName: 'new.csv' })
    ).rejects.toMatchObject({ status: 409 })
    expect(linesTable(operations)).toEqual([])
  })
})
