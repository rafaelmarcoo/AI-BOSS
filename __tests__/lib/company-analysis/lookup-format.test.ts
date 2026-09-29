import {
  CIMA_CASE_STUDIES,
  toStatementLineRows,
} from '@/lib/company-analysis/cima-case-studies'
import { findCompany, findPeers } from '@/lib/company-analysis/lookup'
import {
  formatComparison,
  formatCompanyAnalysis,
  formatPages,
} from '@/lib/company-analysis/format'
import {
  analyseCompany,
  compareCompanies,
  statementsFromCaseStudy,
} from '@/lib/company-analysis/statement-analysis'
import type { AnalysedCompany } from '@/types/database'

// The case studies as they are stored: shared (no owner), one row each.
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

function context(name: string) {
  const study = CIMA_CASE_STUDIES.find((candidate) => candidate.name === name)!
  return {
    company: companies.find((company) => company.name === name)!,
    pages: toStatementLineRows(study).map((row) => row.source_page),
    statements: statementsFromCaseStudy(study),
  }
}

describe('findCompany', () => {
  it.each([
    ['Trimayr', 'Trimayr'],
    ['trimayr', 'Trimayr'],
    ['pallo', 'Pallo & Troo'],
    ['Pallo and Troo', 'Pallo & Troo'],
    ["Ressett's", 'Ressett'],
    ['Ressett’s', 'Ressett'],
    ['Fixxupp Group', 'Fixxupp'],
  ])('finds %p as %s', (query, expected) => {
    const result = findCompany(companies, query)
    expect(result.status).toBe('found')
    expect(result.status === 'found' && result.company.name).toBe(expected)
  })

  it('refuses to guess between several matching companies', () => {
    const alphas = [
      { ...companies[0], id: 'a1', name: 'Alpha One' },
      { ...companies[0], id: 'a2', name: 'Alpha Two' },
    ]
    const result = findCompany(alphas, 'alpha')
    expect(result.status).toBe('ambiguous')
  })

  it('prefers an exact name over partial matches', () => {
    const withHoldings = [...companies, { ...companies[2], id: 'rh', name: 'Ressett Holdings' }]
    const result = findCompany(withHoldings, 'Ressett')
    expect(result.status === 'found' && result.company.id).toBe('Ressett')
  })

  it.each(['Apple', '', '   '])('reports %p as not found', (query) => {
    expect(findCompany(companies, query).status).toBe('not_found')
  })
})

describe('findPeers', () => {
  it('finds a company’s competitor through its peer group', () => {
    const trimayr = companies.find((company) => company.name === 'Trimayr')!
    expect(findPeers(companies, trimayr).map((company) => company.name)).toEqual(['Pallo & Troo'])
  })

  it('finds no peers for a company without a peer group', () => {
    expect(findPeers(companies, { ...companies[0], peer_group: null })).toEqual([])
  })
})

describe('formatPages', () => {
  it('compresses runs of pages into ranges', () => {
    expect(formatPages([19, 16, 17, 17])).toBe('16–17, 19')
  })
})

describe('formatCompanyAnalysis', () => {
  const ressett = context('Ressett')
  const text = formatCompanyAnalysis(analyseCompany(ressett.statements), ressett)

  it.each([
    'Source: CIMA Management Case Study pre-seen material, November 2025–February 2026 (© CIMA 2025), statement pages 17–18.',
    'Revenue: L$197.2m → L$203.3m (+L$6.1m, +3.1%)',
    'Operating margin: 14.0% (prior year 12.0%, +2.0 points, improved)',
    'Working: Operating profit L$28.4m ÷ revenue L$203.3m × 100 = 14.0%',
    'Payable days: 30 days (prior year 32 days, -2 days, a trade-off, not judged better or worse)',
  ])('includes %p', (expected) => {
    expect(text).toContain(expected)
  })

  it('describes each revenue stream for a franchise company', () => {
    const trimayr = context('Trimayr')
    const trimayrText = formatCompanyAnalysis(analyseCompany(trimayr.statements), trimayr)
    expect(trimayrText).toContain(
      'Franchise royalties: D$113.1m, 47.7% of revenue, no direct costs reported, growth +9.9%'
    )
    expect(trimayrText).toContain('Revenue: D$216.2m → D$237.2m (+D$21.0m, +9.7%)')
  })
})

describe('formatComparison', () => {
  it('sets two competitors side by side and names the stronger one', () => {
    const ressett = context('Ressett')
    const fixxupp = context('Fixxupp')
    const text = formatComparison(compareCompanies(ressett.statements, fixxupp.statements), ressett, fixxupp)

    expect(text).toContain('Size (both in L$ millions)')
    expect(text).toContain('Revenue: Ressett +3.1% | Fixxupp +9.7%')
    expect(text).toContain('Operating margin: Ressett 14.0% | Fixxupp 11.0% → stronger: Ressett')
    expect(text).toMatch(/Payable days: Ressett \d+ days \| Fixxupp \d+ days → a trade-off, no winner/)
  })

  it('refuses to set amounts or differently based ratios side by side across currencies', () => {
    const trimayr = context('Trimayr')
    const ressett = context('Ressett')
    const text = formatComparison(compareCompanies(trimayr.statements, ressett.statements), trimayr, ressett)

    expect(text).toContain('Size not compared')
    expect(text).toContain('Margin after direct costs (Trimayr only)')
    expect(text).toContain('Gross margin (Ressett only)')
  })
})
