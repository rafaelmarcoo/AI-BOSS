import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { cellKey, compareWithSaved, describeComparison } from '@/lib/company-analysis/compare-with-saved'
import { statementsFromCaseStudy, type StatementYear } from '@/lib/company-analysis/statement-analysis'

const trimayr = statementsFromCaseStudy(CIMA_CASE_STUDIES.find((study) => study.name === 'Trimayr')!).years
const [latest, prior] = trimayr

function withLines(year: StatementYear, lines: StatementYear['lines']): StatementYear {
  return { ...year, lines: { ...year.lines, ...lines } }
}

describe('compareWithSaved', () => {
  it('finds nothing when the file matches what is saved', () => {
    const comparison = compareWithSaved(trimayr, trimayr)

    expect(comparison.changed.size).toBe(0)
    expect(describeComparison(comparison)).toBe("No changes: this file matches what's saved.")
  })

  it('marks each changed figure with its saved value, as in my 2 Oct test', () => {
    const edited = [withLines(latest, { revenue: 247.2, marketing_expenses: 26.5, administrative_expenses: 59.6, operating_profit: 78.1 }), prior]
    const comparison = compareWithSaved(edited, trimayr)

    expect(Object.fromEntries(comparison.changed)).toEqual({
      [cellKey('Revenue', '2024-12-31')]: 237.2,
      [cellKey('Marketing', '2024-12-31')]: 26.8,
      [cellKey('Administrative expenses', '2024-12-31')]: 58.6,
      [cellKey('Operating profit', '2024-12-31')]: 74.1,
    })
    expect(describeComparison(comparison)).toBe('4 figures changed.')
    expect(comparison.changes.map(({ label, was, now }) => `${label}: ${was} → ${now}`)).toEqual([
      'Revenue: 237.2 → 247.2',
      'Marketing: 26.8 → 26.5',
      'Administrative expenses: 58.6 → 59.6',
      'Operating profit: 74.1 → 78.1',
    ])
  })

  it('shows a new year as added rather than as changed cells', () => {
    const newYear = { ...latest, fiscalYearEnd: '2025-12-31' }
    const comparison = compareWithSaved([newYear, ...trimayr], trimayr)

    expect(comparison.newYears).toEqual(['2025-12-31'])
    expect(comparison.changed.size).toBe(0)
    expect(describeComparison(comparison)).toBe('1 year added.')
  })

  it('notices saved years and lines the file no longer has', () => {
    const withoutTaxPayable = { ...latest.lines }
    delete withoutTaxPayable.tax_payable
    const comparison = compareWithSaved([{ ...latest, lines: withoutTaxPayable }], trimayr)

    expect(comparison.removedYears).toEqual(['2023-12-31'])
    expect(comparison.removedLines).toEqual([{ label: 'Tax payable', fiscalYearEnd: '2024-12-31', was: 9.2 }])
    expect(describeComparison(comparison)).toBe('1 saved year is not in this file, 1 saved figure is missing from this file.')
  })

  it('treats a figure filled in where the saved one was blank as a change', () => {
    const comparison = compareWithSaved([latest, withLines(prior, { dividends: 40 })], trimayr)

    expect(comparison.changed.get(cellKey('Dividends', '2023-12-31'))).toBeNull()
  })

  it('compares revenue streams by name', () => {
    const edited = [
      { ...latest, streams: latest.streams.map((stream) => (stream.name === 'Franchise royalties' ? { ...stream, revenue: 120 } : stream)) },
      prior,
    ]
    const comparison = compareWithSaved(edited, trimayr)

    expect(Object.fromEntries(comparison.changed)).toEqual({
      [cellKey('Revenue stream: Franchise royalties', '2024-12-31')]: 113.1,
    })
  })
})
