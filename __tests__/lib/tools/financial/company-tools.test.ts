import {
  CIMA_CASE_STUDIES,
  toStatementLineRows,
} from '@/lib/company-analysis/cima-case-studies'
import {
  listStatementLines,
  listVisibleCompanies,
} from '@/lib/company-analysis/persistence'
import { createAnalyseCompanyTool } from '@/lib/tools/financial/analyse-company'
import { createCompareCompaniesTool } from '@/lib/tools/financial/compare-companies'
import { createListAnalysedCompaniesTool } from '@/lib/tools/financial/list-analysed-companies'
import type { AnalysedCompany, CompanyStatementLine } from '@/types/database'

jest.mock('@/lib/company-analysis/persistence', () => ({
  listVisibleCompanies: jest.fn(),
  listStatementLines: jest.fn(),
}))

const mockListVisibleCompanies = listVisibleCompanies as jest.MockedFunction<typeof listVisibleCompanies>
const mockListStatementLines = listStatementLines as jest.MockedFunction<typeof listStatementLines>

// A stand-in for the database, filled with the real case-study data.
const companies: AnalysedCompany[] = CIMA_CASE_STUDIES.map((study) => ({
  id: study.name,
  user_id: null,
  name: study.name,
  industry: study.industry,
  peer_group: study.peerGroup,
  currency: study.currency,
  amounts_in: study.amountsIn,
  description: study.description,
  source: study.source,
  created_at: '',
  updated_at: '',
}))

const linesByCompany = new Map<string, CompanyStatementLine[]>(
  CIMA_CASE_STUDIES.map((study) => [
    study.name,
    toStatementLineRows(study).map((row, index) => ({
      ...row,
      id: `${study.name}-${index}`,
      company_id: study.name,
      created_at: '',
      updated_at: '',
    })),
  ])
)

beforeEach(() => {
  jest.clearAllMocks()
  mockListVisibleCompanies.mockResolvedValue(companies)
  mockListStatementLines.mockImplementation(async (companyId) => linesByCompany.get(companyId) ?? [])
})

describe('list_analysed_companies', () => {
  it('lists each company with its competitor, for the signed-in user', async () => {
    const text = await createListAnalysedCompaniesTool('user-1').handler({})

    expect(mockListVisibleCompanies).toHaveBeenCalledWith('user-1', {
      includePrivate: false,
    })
    expect(text).toContain('- Ressett (PC reselling), reporting in L$ millions; competitor: Fixxupp.')
    expect(text).toContain('- Trimayr (Hairdressing franchising), reporting in D$ millions; competitor: Pallo & Troo.')
  })
})

describe('analyse_company', () => {
  const tool = createAnalyseCompanyTool('user-1')

  it('analyses a company found by a partial name, citing its pages', async () => {
    const text = await tool.handler({ company: 'pallo' })
    expect(text).toContain('Pallo & Troo (Hairdressing franchising)')
    expect(text).toContain('statement pages 18–19')
    expect(text).toContain('Marketing as % of revenue: 19.0%')
  })

  it('refuses to analyse a company that is not stored', async () => {
    const text = await tool.handler({ company: 'Apple' })
    expect(text).toContain('No analysed company is called "Apple"')
    expect(text).toContain('Never analyse, estimate or describe')
    expect(mockListStatementLines).not.toHaveBeenCalled()
  })

  it('includes user-private companies only when the private-chat boundary allows it', async () => {
    await createAnalyseCompanyTool('user-1', true).handler({ company: 'Ressett' })

    expect(mockListVisibleCompanies).toHaveBeenCalledWith('user-1', {
      includePrivate: true,
    })
  })
})

describe('compare_companies', () => {
  const tool = createCompareCompaniesTool('user-1')

  it('uses the competitor on record when none is named', async () => {
    const text = await tool.handler({ company: 'Ressett' })
    expect(text).toContain('Ressett compared with Fixxupp.')
    expect(text).toContain('Operating margin: Ressett 14.0% | Fixxupp 11.0% → stronger: Ressett')
  })

  it('compares with a named company, without setting different currencies side by side', async () => {
    const text = await tool.handler({ company: 'Trimayr', competitor: 'Ressett' })
    expect(text).toContain('Trimayr compared with Ressett.')
    expect(text).toContain('Size not compared')
  })

  it('asks which competitor when several are on record', async () => {
    mockListVisibleCompanies.mockResolvedValue([
      ...companies,
      { ...companies[0], id: 'Snipz', name: 'Snipz' },
    ])
    const text = await tool.handler({ company: 'Trimayr' })
    expect(text).toContain('several competitors on record: Pallo & Troo, Snipz')
  })

  it('does not compare a company with itself', async () => {
    const text = await tool.handler({ company: 'Ressett', competitor: "Ressett's" })
    expect(text).toContain('Both names refer to the same company')
  })
})
