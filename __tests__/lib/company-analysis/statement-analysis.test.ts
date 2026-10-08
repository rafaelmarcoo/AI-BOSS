import {
  CIMA_CASE_STUDIES,
  toStatementLineRows,
} from '@/lib/company-analysis/cima-case-studies'
import {
  analyseCompany,
  compareCompanies,
  statementsFromCaseStudy,
  statementsFromLines,
  type CompanyAnalysis,
  type RatioKey,
} from '@/lib/company-analysis/statement-analysis'

function company(name: string) {
  const found = CIMA_CASE_STUDIES.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`no case study named ${name}`)
  return statementsFromCaseStudy(found)
}

function value(analysis: CompanyAnalysis, key: RatioKey) {
  return analysis.latest.ratios.find((ratio) => ratio.key === key)?.value
}

// Expected values were worked out by hand from the pre-seen statements.
describe('analyseCompany', () => {
  const ressett = analyseCompany(company('Ressett'))

  it.each([
    ['gross_margin', 28.0],
    ['operating_margin', 14.0],
    ['net_margin', 11.7],
    ['return_on_capital_employed', 80.9],
    ['return_on_equity', 87.8],
    ['current_ratio', 2.46],
    ['quick_ratio', 1.5],
    ['inventory_days', 38],
    ['receivable_days', 29],
    ['payable_days', 30],
    ['asset_turnover', 3.99],
    ['debt_to_equity', 0.3],
    ['gearing', 22.8],
    ['interest_cover', 40.57],
    ['administration_to_revenue', 14.0],
    ['dividend_payout', 96.2],
  ] as Array<[RatioKey, number]>)('Ressett FY2025 %s is %p', (key, expected) => {
    expect(value(ressett, key)).toBe(expected)
  })

  it('shows the arithmetic with the actual figures', () => {
    const margin = ressett.latest.ratios.find((ratio) => ratio.key === 'operating_margin')
    expect(margin?.working).toBe(
      'Operating profit L$28.4m ÷ revenue L$203.3m × 100 = 14.0%'
    )
  })

  it('measures growth and direction-aware trends against the prior year', () => {
    expect(ressett.growth.find((measure) => measure.label === 'Revenue')?.growthPercent).toBe(3.1)
    const operatingMargin = ressett.trends.find((trend) => trend.key === 'operating_margin')
    expect(operatingMargin).toMatchObject({ prior: 12.0, latest: 14.0, change: 2.0, trend: 'improved' })
  })

  it('does not calculate dividend payout for a year without published dividends', () => {
    expect(ressett.prior?.ratios.some((ratio) => ratio.key === 'dividend_payout')).toBe(false)
    expect(ressett.prior?.unavailable.map((item) => item.key)).toContain('dividend_payout')
  })

  describe('a company reporting revenue streams instead of cost of sales', () => {
    const trimayr = analyseCompany(company('Trimayr'))

    it('reports margin after direct costs, never a gross margin', () => {
      expect(value(trimayr, 'margin_after_direct_costs')).toBe(67.2)
      expect(value(trimayr, 'gross_margin')).toBeUndefined()
      // A different basis is not a gap, so it is not listed as unavailable.
      expect(trimayr.latest.unavailable.map((item) => item.key)).not.toContain('gross_margin')
    })

    it('uses direct costs as the cost base for inventory days and says so', () => {
      const days = trimayr.latest.ratios.find((ratio) => ratio.key === 'inventory_days')
      expect(days?.value).toBe(20)
      expect(days?.working).toContain('direct costs D$77.7m')
    })

    it('analyses each revenue stream', () => {
      const royalties = trimayr.latest.streams.find((stream) => stream.name === 'Franchise royalties')
      expect(royalties).toMatchObject({
        shareOfRevenuePercent: 47.7,
        marginAfterDirectCostsPercent: null,
        growthPercent: 9.9,
      })
      const products = trimayr.latest.streams.find((stream) => stream.name === 'Product sales to franchisees')
      expect(products?.marginAfterDirectCostsPercent).toBe(38.0)
    })

    it('captures the cost-structure difference between Trimayr and Pallo & Troo', () => {
      const pallo = analyseCompany(company('Pallo & Troo'))
      expect(value(trimayr, 'marketing_to_revenue')).toBe(11.3)
      expect(value(pallo, 'marketing_to_revenue')).toBe(19.0)
    })
  })
})

describe('compareCompanies', () => {
  const comparison = compareCompanies(company('Ressett'), company('Fixxupp'))

  it('names the stronger company, respecting which way is better', () => {
    const operatingMargin = comparison.ratios.find((ratio) => ratio.key === 'operating_margin')
    expect(operatingMargin).toMatchObject({ first: 14.0, second: 11.0, stronger: 'Ressett' })
    // Lower is better for debt to equity.
    const debt = comparison.ratios.find((ratio) => ratio.key === 'debt_to_equity')
    expect(debt).toMatchObject({ first: 0.3, second: 0.4, stronger: 'Ressett' })
  })

  it('does not pick a winner on a trade-off ratio', () => {
    const payables = comparison.ratios.find((ratio) => ratio.key === 'payable_days')
    expect(payables?.stronger).toBeNull()
  })

  it('shows Fixxupp growing faster while Ressett is more profitable', () => {
    expect(comparison.growth.find((row) => row.label === 'Revenue')).toEqual({
      label: 'Revenue',
      first: 3.1,
      second: 9.7,
    })
  })

  it('compares absolute sizes only within one currency', () => {
    expect(comparison.size).toMatchObject({ comparable: true })
    expect(comparison.periodNote).toBeNull()

    const acrossCurrencies = compareCompanies(company('Trimayr'), company('Ressett'))
    expect(acrossCurrencies.size).toMatchObject({ comparable: false })
    expect(acrossCurrencies.periodNote).toContain('different dates')
  })
})

describe('statementsFromLines', () => {
  it.each(CIMA_CASE_STUDIES.map((study) => [study.name, study]))(
    'rebuilds %s from database rows exactly as from the seed data',
    (_name, study) => {
      const fromRows = statementsFromLines(
        { name: study.name, currency: study.currency, amountsIn: study.amountsIn },
        toStatementLineRows(study)
      )
      expect(fromRows).toEqual(statementsFromCaseStudy(study))
    }
  )
})
