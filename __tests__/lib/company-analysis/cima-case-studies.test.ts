import {
  CIMA_CASE_STUDIES,
  toStatementLineRows,
  type CaseStudyYear,
} from '@/lib/company-analysis/cima-case-studies'
import {
  isSegmentLineKey,
  isStatementLineKey,
} from '@/lib/company-analysis/statement-lines'

// Published figures are rounded to one decimal place, so a recomputed total may
// differ from the printed one by rounding only. Anything larger is a typo.
const ROUNDING = 0.051

function line(year: CaseStudyYear, key: keyof CaseStudyYear['lines']) {
  const value = year.lines[key]
  if (value === undefined) throw new Error(`missing ${key} for ${year.fiscalYearEnd}`)
  return value
}

const cases = CIMA_CASE_STUDIES.flatMap((company) =>
  company.years.map((year, index) => ({
    label: `${company.name} ${year.fiscalYearEnd}`,
    company,
    year,
    priorYear: company.years[index + 1],
  }))
)

describe('CIMA case-study statements', () => {
  it('holds each company with its competitor, two years each', () => {
    expect(CIMA_CASE_STUDIES.map((company) => company.name)).toEqual([
      'Trimayr',
      'Pallo & Troo',
      'Ressett',
      'Fixxupp',
    ])
    for (const company of CIMA_CASE_STUDIES) {
      expect(company.years).toHaveLength(2)
      const peers = CIMA_CASE_STUDIES.filter((other) => other.peerGroup === company.peerGroup)
      expect(peers).toHaveLength(2)
    }
  })

  describe.each(cases)('$label', ({ year, priorYear }) => {
    it('revenue equals the sum of its revenue streams', () => {
      if (!year.revenueStreams) return
      const streams = year.revenueStreams.reduce((sum, stream) => sum + stream.revenue, 0)
      expect(Math.abs(line(year, 'revenue') - streams)).toBeLessThan(ROUNDING)
    })

    it('operating profit follows from revenue and costs', () => {
      if (year.lines.cost_of_sales !== undefined) {
        const gross = line(year, 'revenue') - line(year, 'cost_of_sales')
        expect(Math.abs(line(year, 'gross_profit') - gross)).toBeLessThan(ROUNDING)
        const operating =
          line(year, 'gross_profit') -
          line(year, 'administrative_expenses') -
          (year.lines.marketing_expenses ?? 0)
        expect(Math.abs(line(year, 'operating_profit') - operating)).toBeLessThan(ROUNDING)
        return
      }

      const directCosts = (year.revenueStreams ?? []).reduce(
        (sum, stream) => sum + (stream.directCosts ?? 0),
        0
      )
      const totalCosts =
        directCosts + line(year, 'marketing_expenses') + line(year, 'administrative_expenses')
      expect(Math.abs(line(year, 'total_operating_costs') - totalCosts)).toBeLessThan(ROUNDING)
      const operating = line(year, 'revenue') - line(year, 'total_operating_costs')
      expect(Math.abs(line(year, 'operating_profit') - operating)).toBeLessThan(ROUNDING)
    })

    it('profit before and after tax follow from operating profit', () => {
      const beforeTax = line(year, 'operating_profit') - line(year, 'finance_costs')
      expect(Math.abs(line(year, 'profit_before_tax') - beforeTax)).toBeLessThan(ROUNDING)
      const afterTax = line(year, 'profit_before_tax') - line(year, 'tax_expense')
      expect(Math.abs(line(year, 'profit_for_year') - afterTax)).toBeLessThan(ROUNDING)
    })

    it('asset subtotals add up', () => {
      const nonCurrent = line(year, 'intangible_assets') + line(year, 'property_plant_equipment')
      expect(Math.abs(line(year, 'non_current_assets') - nonCurrent)).toBeLessThan(ROUNDING)
      const current = line(year, 'inventory') + line(year, 'trade_receivables') + line(year, 'cash')
      expect(Math.abs(line(year, 'current_assets') - current)).toBeLessThan(ROUNDING)
      const total = line(year, 'non_current_assets') + line(year, 'current_assets')
      expect(Math.abs(line(year, 'total_assets') - total)).toBeLessThan(ROUNDING)
    })

    it('the statement of financial position balances', () => {
      const equity = line(year, 'share_capital') + line(year, 'retained_earnings')
      expect(Math.abs(line(year, 'total_equity') - equity)).toBeLessThan(ROUNDING)
      const currentLiabilities = line(year, 'trade_payables') + line(year, 'tax_payable')
      expect(Math.abs(line(year, 'current_liabilities') - currentLiabilities)).toBeLessThan(ROUNDING)
      const fundedBy =
        line(year, 'total_equity') +
        line(year, 'non_current_borrowings') +
        line(year, 'current_liabilities')
      expect(Math.abs(line(year, 'total_assets') - fundedBy)).toBeLessThan(ROUNDING)
    })

    it('retained earnings roll forward through profit and dividends', () => {
      if (year.lines.dividends === undefined || !priorYear) return
      const rolled =
        line(priorYear, 'retained_earnings') +
        line(year, 'profit_for_year') -
        line(year, 'dividends')
      expect(Math.abs(line(year, 'retained_earnings') - rolled)).toBeLessThan(ROUNDING)
    })
  })

  it('produces only rows the database will accept, each with a source page', () => {
    for (const company of CIMA_CASE_STUDIES) {
      const rows = toStatementLineRows(company)
      const keys = new Set<string>()

      for (const row of rows) {
        expect(isStatementLineKey(row.line_key)).toBe(true)
        // Mirrors company_statement_lines_segment_check.
        expect(row.segment !== '').toBe(isSegmentLineKey(row.line_key))
        expect(row.source_page).toBeGreaterThan(0)
        // Mirrors the (company, year, line, segment) unique constraint.
        const identity = `${row.fiscal_year_end}|${row.line_key}|${row.segment}`
        expect(keys.has(identity)).toBe(false)
        keys.add(identity)
      }
    }
  })
})
