import { parseCsvTabularData } from '@/lib/documents/tabular'
import { combineSources, describeCombinedSources, type CombinableObservation } from '@/lib/financial-data/combine-sources'
import { extractCsvFinancialMetrics } from '@/lib/financial-data/extraction/csv'

function figure(
  metric: CombinableObservation['metric_key'],
  value: number,
  date: string,
  source: string,
  uploaded: string
): CombinableObservation {
  return {
    metric_key: metric,
    value,
    currency: metric === 'runway_months' ? null : 'NZD',
    as_of_date: date,
    period_start: null,
    period_end: null,
    source_label: source,
    created_at: uploaded,
  }
}

const consistent = [
  figure('cash', 100000, '2026-03-31', 'ai-boss-demo-consistent.csv', '2026-09-01T00:00:00Z'),
  figure('burn_rate', 15000, '2026-03-31', 'ai-boss-demo-consistent.csv', '2026-09-01T00:00:00Z'),
  figure('cash', 80000, '2026-05-31', 'ai-boss-demo-consistent.csv', '2026-09-01T00:00:00Z'),
]
const snapshot = [
  figure('cash', 185000, '2026-05-18', 'financial-data.csv', '2026-09-10T00:00:00Z'),
  figure('burn_rate', 23000, '2026-05-18', 'financial-data.csv', '2026-09-10T00:00:00Z'),
]
const statements = [
  figure('cash', 215000, '2026-06-30', 'ai-boss-demo-full-statements.csv', '2026-09-17T00:00:00Z'),
  figure('runway_months', 11.43, '2026-06-30', 'ai-boss-demo-full-statements.csv', '2026-09-17T00:00:00Z'),
]

describe('combineSources', () => {
  it('puts every figure from all three files into one file, oldest date first', () => {
    const combined = combineSources([...statements, ...snapshot, ...consistent])
    const lines = combined.csv.trim().split('\n')

    expect(lines[0]).toBe('Metric,Amount,Currency,Date,Source')
    expect(lines.slice(1)).toEqual([
      'Cash,100000,NZD,2026-03-31,ai-boss-demo-consistent.csv',
      'Burn rate,15000,NZD,2026-03-31,ai-boss-demo-consistent.csv',
      'Cash,185000,NZD,2026-05-18,financial-data.csv',
      'Burn rate,23000,NZD,2026-05-18,financial-data.csv',
      'Cash,80000,NZD,2026-05-31,ai-boss-demo-consistent.csv',
      'Cash,215000,NZD,2026-06-30,ai-boss-demo-full-statements.csv',
    ])
    expect(combined.rowCount).toBe(6)
    expect(combined.clashes).toEqual([])
  })

  it('leaves runway out, because AI-BOSS recalculates it', () => {
    const combined = combineSources(statements)
    expect(combined.runwayRowsLeftOut).toBe(1)
    expect(combined.csv).not.toContain('Runway')
  })

  it('keeps an identical figure from two files once', () => {
    const copy = figure('cash', 100000, '2026-03-31', 'copy.csv', '2026-09-20T00:00:00Z')
    const combined = combineSources([...consistent, copy])

    expect(combined.rowCount).toBe(3)
    expect(combined.duplicatesMerged).toBe(1)
    expect(combined.clashes).toEqual([])
  })

  it('keeps the newest upload when two files disagree, and reports the clash', () => {
    const newer = figure('cash', 95000, '2026-05-31', 'corrected.csv', '2026-10-01T00:00:00Z')
    const combined = combineSources([...consistent, newer])

    expect(combined.csv).toContain('Cash,95000,NZD,2026-05-31,corrected.csv')
    expect(combined.csv).not.toContain('Cash,80000')
    expect(combined.clashes).toEqual([
      {
        metric: 'Cash',
        date: '2026-05-31',
        currency: 'NZD',
        kept: { value: 95000, source: 'corrected.csv' },
        dropped: [{ value: 80000, source: 'ai-boss-demo-consistent.csv' }],
      },
    ])
  })

  it('makes a file that uploads back with the same figures', () => {
    const combined = combineSources([...statements, ...snapshot, ...consistent])
    const sheet = parseCsvTabularData(new TextEncoder().encode(combined.csv)).sheets[0]
    const reread = extractCsvFinancialMetrics({
      csvData: { headers: sheet.headers, rows: sheet.rows },
      documentId: 'combined',
      sourceLabel: 'combined.csv',
      extractedAt: '2026-10-07T00:00:00Z',
    })

    expect(reread.map((metric) => [metric.key, metric.value, metric.currency, metric.asOfDate])).toEqual([
      ['cash', 100000, 'NZD', '2026-03-31'],
      ['burn_rate', 15000, 'NZD', '2026-03-31'],
      ['cash', 185000, 'NZD', '2026-05-18'],
      ['burn_rate', 23000, 'NZD', '2026-05-18'],
      ['cash', 80000, 'NZD', '2026-05-31'],
      ['cash', 215000, 'NZD', '2026-06-30'],
    ])
  })
})

describe('period columns', () => {
  it('leaves them out when no figure covers a period, as with my three files', () => {
    expect(combineSources(consistent).csv.split('\n')[0]).toBe('Metric,Amount,Currency,Date,Source')
  })

  it('includes them when a file reports a period, and it still uploads back', () => {
    const july = { ...figure('monthly_revenue', 39000, '', 'xero', '2026-09-01T00:00:00Z'), as_of_date: null, period_start: '2026-07-01', period_end: '2026-07-31' }
    const combined = combineSources([july, ...consistent])
    const lines = combined.csv.trim().split('\n')

    expect(lines[0]).toBe('Metric,Amount,Currency,Date,Period start,Period end,Source')
    expect(lines).toContain('Monthly revenue,39000,NZD,,2026-07-01,2026-07-31,xero')

    const sheet = parseCsvTabularData(new TextEncoder().encode(combined.csv)).sheets[0]
    const reread = extractCsvFinancialMetrics({
      csvData: { headers: sheet.headers, rows: sheet.rows },
      documentId: 'combined',
      sourceLabel: 'combined.csv',
      extractedAt: '2026-10-08T00:00:00Z',
    })
    expect(reread.find((metric) => metric.key === 'monthly_revenue')).toMatchObject({
      value: 39000,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
    })
  })
})

describe('data checks', () => {
  const month = (source: string, date: string, revenue: number, expenses: number, burn: number) => [
    figure('monthly_revenue', revenue, date, source, '2026-09-17T00:00:00Z'),
    figure('monthly_expenses', expenses, date, source, '2026-09-17T00:00:00Z'),
    figure('burn_rate', burn, date, source, '2026-09-17T00:00:00Z'),
  ]

  it('accepts a month where burn equals expenses minus revenue', () => {
    expect(combineSources(month('full.csv', '2026-07-31', 39000, 61000, 22000)).warnings).toEqual([])
  })

  it('flags my real June figures: burn -21,000 when expenses − revenue = 21,000', () => {
    expect(combineSources(month('ai-boss-demo-full-statements.csv', '2026-06-29', 40000, 61000, -21000)).warnings).toEqual([
      'Burn rate is NZD -21,000 on 29 Jun 2026 in ai-boss-demo-full-statements.csv, but monthly expenses − monthly revenue = NZD 21,000.',
    ])
  })

  it('flags my real financial-data.csv snapshot: burn 23,000 when expenses − revenue = -38,000', () => {
    const [warning] = combineSources(month('financial-data.csv', '2026-05-18', 61000, 23000, 23000)).warnings
    expect(warning).toContain('monthly expenses − monthly revenue = NZD -38,000')
  })

  it('flags a balance that cannot be negative', () => {
    expect(combineSources([figure('cash', -500, '2026-05-31', 'x.csv', '2026-09-01T00:00:00Z')]).warnings).toEqual([
      "Cash is negative (NZD -500) on 31 May 2026 in x.csv, but it can't be below zero.",
    ])
  })

  it('still copies the flagged figures as they are, and says so in the summary', () => {
    const combined = combineSources(month('full.csv', '2026-06-29', 40000, 61000, -21000))
    expect(combined.csv).toContain('Burn rate,-21000,NZD,2026-06-29,full.csv')
    expect(describeCombinedSources(combined, '/x')).toContain('Worth checking (1): these figures look wrong.')
  })
})

describe('describeCombinedSources', () => {
  it('summarises the sources and ends with the download link', () => {
    const text = describeCombinedSources(combineSources([...statements, ...snapshot, ...consistent]), '/api/financial-data/combined-csv')

    expect(text).toContain('Combined 6 figures from 3 sources into one CSV:')
    expect(text).toContain('- financial-data.csv: 2 figures (2 kept)')
    expect(text).toContain('No clashes')
    expect(text).toContain('Runway rows were left out (1)')
    expect(text.trim().endsWith('[Download combined CSV](/api/financial-data/combined-csv)')).toBe(true)
  })

  it('lists each clash with what was kept and dropped', () => {
    const newer = figure('cash', 95000, '2026-05-31', 'corrected.csv', '2026-10-01T00:00:00Z')
    const text = describeCombinedSources(combineSources([...consistent, newer]), '/x')

    expect(text).toContain('- Cash, 2026-05-31: kept NZD 95,000 from corrected.csv; dropped NZD 80,000 from ai-boss-demo-consistent.csv')
  })

  it('says when there is nothing to combine', () => {
    expect(describeCombinedSources(combineSources([]), '/x')).toContain('no confirmed figures to combine yet')
  })
})
