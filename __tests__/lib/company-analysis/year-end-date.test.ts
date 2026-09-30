import { parseStatementCsv } from '@/lib/company-analysis/statement-csv'
import { parseYearEnd } from '@/lib/company-analysis/year-end-date'

describe('parseYearEnd', () => {
  it.each([
    ['2025-03-31', '2025-03-31'],
    ['3/31/2025', '2025-03-31'],
    ['31/03/2025', '2025-03-31'],
    ['31-03-2025', '2025-03-31'],
    ['31.03.2025', '2025-03-31'],
    ['6/30/25', '2025-06-30'],
    ['31/12/2024', '2024-12-31'],
    ['31 Mar 2025', '2025-03-31'],
    ['31-Mar-25', '2025-03-31'],
    ['31 March 2025', '2025-03-31'],
    ['Mar 31, 2025', '2025-03-31'],
    ['5/5/2025', '2025-05-05'],
  ])('reads %p as %s', (heading, expected) => {
    expect(parseYearEnd(heading)).toEqual({ ok: true, date: expected })
  })

  it('refuses a date that could be read two ways instead of guessing', () => {
    const result = parseYearEnd('3/4/2025')
    expect(result).toEqual({
      ok: false,
      message: 'The column heading "3/4/2025" could be 3 April or 4 March. Write it like 2025-04-03 or 2025-03-04.',
    })
  })

  it.each(['FY2025', '2025', '2025-02-30', '31/02/2025', '13/13/2025', '31 Foo 2025', 'Ma 31, 2025', ''])(
    'refuses %p as not a date',
    (heading) => {
      const result = parseYearEnd(heading)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain("isn't a date")
    }
  )
})

describe('Excel-saved statement files', () => {
  const encode = (lines: string[]) => new TextEncoder().encode(lines.join('\n'))

  it('reads a file whose headings Excel rewrote in US format', () => {
    const result = parseStatementCsv(encode(['Line,3/31/2025,3/31/2024', 'Revenue,203.3,197.2', 'Cost of sales,-146.4,-144']))
    expect(result.errors).toEqual([])
    expect(result.years.map((year) => year.fiscalYearEnd)).toEqual(['2025-03-31', '2024-03-31'])
    expect(result.years[0].lines).toEqual({ revenue: 203.3, cost_of_sales: 146.4 })
  })

  it('catches the same year written two different ways', () => {
    const result = parseStatementCsv(encode(['Line,2025-03-31,31/03/2025', 'Revenue,203.3,197.2']))
    expect(result.errors).toEqual(['The year 2025-03-31 is in the file twice.'])
  })
})
