import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'
import { checkStatements, checkStatementYear } from '@/lib/company-analysis/statement-checks'
import { parseStatementCsv } from '@/lib/company-analysis/statement-csv'
import { buildStatementTemplate } from '@/lib/company-analysis/statement-template'
import { STATEMENT_LINE_KEYS, STATEMENT_LINE_LABELS } from '@/lib/company-analysis/statement-lines'

const encode = (text: string) => new TextEncoder().encode(text)

function study(name: string) {
  return statementsFromCaseStudy(CIMA_CASE_STUDIES.find((candidate) => candidate.name === name)!)
}

describe('statement checks', () => {
  it.each(CIMA_CASE_STUDIES.map((company) => company.name))('every check passes for %s', (name) => {
    const results = checkStatements(study(name).years)
    const checks = results.flatMap((result) => result.checks)
    expect(checks.length).toBeGreaterThan(10)
    expect(checks.filter((result) => !result.passed)).toEqual([])
  })

  it('explains a planted mistake in plain English', () => {
    const [latest, prior] = study('Ressett').years
    const typo = { ...latest, lines: { ...latest.lines, inventory: 15.3 } }
    const failed = checkStatementYear(typo, prior).filter((result) => !result.passed)

    expect(failed.map((result) => result.id)).toEqual(['current_assets'])
    expect(failed[0].message).toBe(
      'Current assets add up: the statement shows 39.1, but its parts add up to 39.2.'
    )
  })

  it('skips checks whose lines are missing rather than failing them', () => {
    expect(checkStatementYear({ fiscalYearEnd: '2025-03-31', lines: { revenue: 100 }, streams: [] })).toEqual([])
  })
})

describe('upload template', () => {
  it.each(CIMA_CASE_STUDIES.map((company) => company.name))(
    'writes %s as a template and reads it back exactly',
    (name) => {
      const original = study(name)
      const result = parseStatementCsv(encode(buildStatementTemplate(original.years)))

      expect(result.errors).toEqual([])
      expect(result.unrecognised).toEqual([])
      expect(result.years).toEqual(original.years)
    }
  )

  it('recognises every label the template writes', () => {
    const keys = STATEMENT_LINE_KEYS.filter((key) => key !== 'segment_revenue' && key !== 'segment_direct_costs')
    const csv = ['Line,2025-03-31', ...keys.map((key) => `"${STATEMENT_LINE_LABELS[key]}",1`)].join('\n')
    const result = parseStatementCsv(encode(csv))

    expect(result.unrecognised).toEqual([])
    expect(Object.keys(result.years[0].lines).sort()).toEqual([...keys].sort())
  })
})

describe('parseStatementCsv', () => {
  it('stores bracketed costs as positive and keeps a loss negative', () => {
    const result = parseStatementCsv(
      encode(['Line,2025-03-31', 'Revenue,"1,200.5"', 'Cost of sales,(800)', 'Operating profit,-45.5', 'Inventory,-'].join('\n'))
    )

    expect(result.errors).toEqual([])
    expect(result.years[0].lines).toEqual({
      revenue: 1200.5,
      cost_of_sales: 800,
      operating_profit: -45.5,
    })
  })

  it('reads revenue streams and their direct costs', () => {
    const result = parseStatementCsv(
      encode(['Line,2024-12-31', 'Revenue stream: Royalties,113.1', 'Revenue stream: Salons,62.4', 'Direct costs: Salons,(38.1)'].join('\n'))
    )

    expect(result.years[0].streams).toEqual([
      { name: 'Royalties', revenue: 113.1, directCosts: null },
      { name: 'Salons', revenue: 62.4, directCosts: 38.1 },
    ])
  })

  it('lists unrecognised rows instead of guessing what they are', () => {
    const result = parseStatementCsv(encode(['Line,2025-03-31', 'Revenue,100', 'Other income,5'].join('\n')))

    expect(result.errors).toEqual([])
    expect(result.unrecognised).toEqual([{ rowNumber: 3, label: 'Other income' }])
    expect(result.years[0].lines).toEqual({ revenue: 100 })
  })

  it.each([
    ['a year heading that is not a date', ['Line,FY2025', 'Revenue,100'], 'must be a year-end date'],
    ['the same year twice', ['Line,2025-03-31,2025-03-31', 'Revenue,100,90'], 'appears more than once'],
    ['the same line twice', ['Line,2025-03-31', 'Revenue,100', 'Sales,90'], 'appears more than once (rows 2 and 3)'],
    ['a figure that is not a number', ['Line,2025-03-31', 'Revenue,L$100'], 'is not a number'],
    ['no recognisable lines', ['Line,2025-03-31', 'Other income,5'], 'No statement lines were recognised'],
    ['direct costs without their revenue stream', ['Line,2025-03-31', 'Revenue,100', 'Direct costs: Salons,(5)'], 'has no matching "Revenue stream: Salons"'],
    ['an impossible date', ['Line,2025-02-30', 'Revenue,100'], 'must be a year-end date'],
  ])('rejects %s', (_case, lines, message) => {
    const result = parseStatementCsv(encode(lines.join('\n')))
    expect(result.years).toEqual([])
    expect(result.errors.join(' ')).toContain(message)
  })
})

describe('impossible values', () => {
  const read = (lines: string[]) => parseStatementCsv(encode(lines.join('\n')))

  it.each([
    ['negative revenue', 'Revenue,-500', 'Revenue cannot be negative'],
    ['massive negative revenue', 'Revenue,-999999999', 'Revenue cannot be negative'],
    ['a negative revenue stream', 'Revenue stream: Royalties,-10', 'cannot be negative'],
    ['a negative asset', 'Inventory,-5', 'Inventory cannot be negative'],
    ['a negative liability', 'Current liabilities,-20', 'Current liabilities cannot be negative'],
    ['a bracketed revenue figure', 'Revenue,(203.3)', 'Revenue cannot be negative'],
  ])('blocks %s', (_case, row, message) => {
    const result = read(['Line,2025-03-31', row])
    expect(result.years).toEqual([])
    expect(result.errors.join(' ')).toContain(message)
  })

  it('explains that an overdraft is a liability, not negative cash', () => {
    const result = read(['Line,2025-03-31', 'Bank,-50'])
    expect(result.errors.join(' ')).toContain('An overdraft belongs under liabilities')
  })

  it('blocks a figure too large to store instead of failing on save', () => {
    const result = read(['Line,2025-03-31', 'Revenue,999999999999999999999'])
    expect(result.years).toEqual([])
    expect(result.errors.join(' ')).toContain('too large to store')
  })

  it('allows the lines that can legitimately be negative', () => {
    const result = read([
      'Line,2025-03-31',
      'Operating profit,-45.5',
      'Profit for the year,-50',
      'Retained earnings,-12',
      'Total equity,-2',
    ])
    expect(result.errors).toEqual([])
    expect(result.years[0].lines).toEqual({
      operating_profit: -45.5,
      profit_for_year: -50,
      retained_earnings: -12,
      total_equity: -2,
    })
  })

  it('reports a bad cell once, without a second "no figures" error', () => {
    const result = read(['Line,2025-03-31', 'Revenue,abc'])
    expect(result.errors).toEqual([
      'Row 2 ("Revenue"): "abc" in 2025-03-31 is not a number.',
    ])
  })

  it.each(['1e5', 'L$203.3', 'abc'])('rejects %p as not a number', (value) => {
    expect(read(['Line,2025-03-31', `Revenue,${value}`]).errors.join(' ')).toContain('is not a number')
  })

  it('treats a runway row as unrecognised, since annual statements have no runway line', () => {
    const result = read(['Line,2025-03-31', 'Revenue,100', 'Runway,9.09'])
    expect(result.errors).toEqual([])
    expect(result.unrecognised.map((row) => row.label)).toEqual(['Runway'])
  })
})
