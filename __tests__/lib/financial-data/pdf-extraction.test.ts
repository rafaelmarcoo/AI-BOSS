import { extractPdfFinancialMetrics } from '@/lib/financial-data/extraction/pdf'
import {
  CASH_BURN_STATEMENT_LINES,
  DATED_FINANCIAL_STATEMENT_LINES,
  UNDATED_FINANCIAL_STATEMENT_LINES,
} from '@/test-fixtures/pdf-metric-extraction'

function extract(lines: string[]) {
  return extractPdfFinancialMetrics({
    pages: [{ pageNumber: 2, text: lines.join('\n'), lines }],
    documentId: 'document-123',
    sourceLabel: 'May statement.pdf',
    extractedAt: '2026-06-01T00:00:00.000Z',
  })
}

describe('extractPdfFinancialMetrics', () => {
  it('extracts dated, labelled metrics with currency and page evidence', () => {
    const metrics = extract(DATED_FINANCIAL_STATEMENT_LINES)

    expect(metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'cash', value: 120000, currency: 'NZD', asOfDate: '2026-05-31',
        provenance: expect.objectContaining({
          evidence: expect.objectContaining({ sourcePage: 2, excerpt: 'Cash at bank: $120,000 NZD' }),
        }),
      }),
      expect.objectContaining({ key: 'accounts_receivable', value: 45000 }),
    ]))
  })

  it('extracts runway values expressed in months', () => {
    const metrics = extract([
      'Statement date: 31/05/2026',
      'Runway: 7 months',
    ])

    expect(metrics).toEqual([
      expect.objectContaining({ key: 'runway_months', value: 7, currency: null }),
    ])
  })

  it('prioritises cash burn over the broad cash label and supports negative values', () => {
    const metrics = extract(CASH_BURN_STATEMENT_LINES)

    expect(metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'burn_rate', value: -12500 }),
      expect.objectContaining({ key: 'cash', value: 100000 }),
    ]))
  })

  it('does not create history-affecting metrics without a clear reporting date', () => {
    expect(extract(UNDATED_FINANCIAL_STATEMENT_LINES)).toEqual([])
  })

  it('keeps the first clear occurrence of each metric', () => {
    const metrics = extract([
      'As of 2026-05-31',
      'Cash: 100,000 NZD',
      'Cash: 120,000 NZD',
    ])

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toEqual(expect.objectContaining({ key: 'cash', value: 100000 }))
  })

  it('does not extract unsupported labels', () => {
    expect(extract([
      'As at 31 May 2026',
      'Inventory: 55,000 NZD',
      'Debt to equity: 1.2',
    ])).toEqual([])
  })
})
