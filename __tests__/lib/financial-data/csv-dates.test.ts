import { parseYearEnd } from '@/lib/company-analysis/year-end-date'
import { extractCsvFinancialMetrics } from '@/lib/financial-data/extraction/csv'

function dateRead(date: string) {
  const [metric] = extractCsvFinancialMetrics({
    csvData: {
      headers: ['Metric', 'Amount', 'Currency', 'Date'],
      rows: [{ rowNumber: 2, values: ['Cash', '185000', 'NZD', date], cells: { Metric: 'Cash', Amount: '185000', Currency: 'NZD', Date: date } }],
    },
    documentId: 'document-1',
    sourceLabel: 'financial-data.csv',
    extractedAt: '2026-10-08T00:00:00.000Z',
  })
  return metric.asOfDate
}

describe('dates in uploaded financial CSVs (Documents)', () => {
  it.each([
    ['2026-05-18', '2026-05-18', 'the format AI-BOSS writes'],
    ['5/18/2026', '2026-05-18', 'US Excel; it used to come out a day early (2026-05-17)'],
    ['18/05/2026', '2026-05-18', 'NZ Excel; it used to lose its date entirely'],
    ['31/03/2026', '2026-03-31', 'NZ month-end'],
    ['18 May 2026', '2026-05-18', 'written out; it used to come out a day early'],
    ['05/06/2026', '2026-06-05', 'ambiguous, so read the NZ way: 5 June'],
    ['2026-05-18T00:00:00Z', '2026-05-18', 'a full timestamp'],
  ])('reads %p as %p (%s)', (written, expected) => {
    expect(dateRead(written)).toBe(expected)
  })

  it('keeps the figure but without a date when the cell is not a date', () => {
    expect(dateRead('FY2026')).toBeNull()
  })
})

describe('parseYearEnd ambiguous option', () => {
  it('still refuses an ambiguous company year-end by default', () => {
    expect(parseYearEnd('3/4/2025').ok).toBe(false)
  })

  it('reads it the NZ way when asked', () => {
    expect(parseYearEnd('3/4/2025', { ambiguous: 'day-first' })).toEqual({ ok: true, date: '2025-04-03' })
  })
})
