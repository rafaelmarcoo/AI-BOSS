import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { groupRatios, RATIO_MEANINGS, ratiosOnlyOneHas, verdict, workingFor } from '@/lib/company-analysis/compare-view'
import { analyseCompany, compareCompanies, statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'

const study = (name: string) => statementsFromCaseStudy(CIMA_CASE_STUDIES.find((company) => company.name === name)!)

describe('compare page view', () => {
  it('has a plain meaning for every ratio any case study produces', () => {
    const keys = CIMA_CASE_STUDIES.flatMap((company) => analyseCompany(statementsFromCaseStudy(company)).latest.ratios.map((ratio) => ratio.key))
    for (const key of keys) expect(RATIO_MEANINGS[key]).toBeTruthy()
  })

  it('groups Ressett vs Fixxupp under plain headings, profit first, with nothing left out', () => {
    const comparison = compareCompanies(study('Ressett'), study('Fixxupp'))
    const groups = groupRatios(comparison.ratios)

    expect(groups[0].heading).toBe('Profit: how much of each sale is kept')
    expect(groups.flatMap((group) => group.ratios)).toHaveLength(comparison.ratios.length)
  })

  it('names the stronger company per ratio, and calls trade-offs trade-offs', () => {
    const comparison = compareCompanies(study('Ressett'), study('Fixxupp'))
    const ratio = (key: string) => comparison.ratios.find((item) => item.key === key)!

    expect(verdict(ratio('operating_margin'))).toEqual({ kind: 'stronger', text: 'Ressett' })
    expect(verdict(ratio('payable_days'))).toEqual({ kind: 'trade-off', text: 'Trade-off' })
  })

  it('explains the ratios only one company has: Ressett vs Trimayr', () => {
    const oneSided = ratiosOnlyOneHas(compareCompanies(study('Ressett'), study('Trimayr')))
    const byKey = Object.fromEntries(oneSided.map((ratio) => [ratio.key, ratio]))

    expect(byKey.gross_margin).toMatchObject({ has: 'Ressett' })
    expect(byKey.gross_margin.reason).toContain('different basis')
    expect(byKey.margin_after_direct_costs).toMatchObject({ has: 'Trimayr' })
    expect(byKey.marketing_to_revenue).toMatchObject({ has: 'Trimayr' })
    expect(byKey.marketing_to_revenue.reason).toContain('Ressett has no')
  })

  it('finds the working for each side', () => {
    const comparison = compareCompanies(study('Ressett'), study('Fixxupp'))
    expect(workingFor(comparison, 'first', 'operating_margin')).toBe(
      'Operating profit L$28.4m ÷ revenue L$203.3m × 100 = 14.0%'
    )
  })
})
