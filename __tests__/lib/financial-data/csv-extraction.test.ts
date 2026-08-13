import { extractCsvFinancialMetrics } from '@/lib/financial-data/extraction/csv'
import type { ParsedCsvData } from '@/lib/documents/types'

describe('extractCsvFinancialMetrics', () => {
  it('extracts canonical metrics from row-label CSV data', () => {
    const csvData: ParsedCsvData = {
      headers: ['Account', 'Amount', 'Currency', 'Date'],
      rows: [
        {
          rowNumber: 1,
          values: ['Cash at bank', '120000', 'NZD', '2026-05-12'],
          cells: {
            Account: 'Cash at bank',
            Amount: '120000',
            Currency: 'NZD',
            Date: '2026-05-12',
          },
        },
        {
          rowNumber: 2,
          values: ['Debtors', '45000', 'NZD', '2026-05-12'],
          cells: {
            Account: 'Debtors',
            Amount: '45000',
            Currency: 'NZD',
            Date: '2026-05-12',
          },
        },
        {
          rowNumber: 3,
          values: ['Operating expenses', '52000', 'NZD', '2026-04-30'],
          cells: {
            Account: 'Operating expenses',
            Amount: '52000',
            Currency: 'NZD',
            Date: '2026-04-30',
          },
        },
      ],
    }

    const metrics = extractCsvFinancialMetrics({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'financial-summary.csv',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(metrics).toHaveLength(3)
    expect(metrics.map((metric) => metric.key)).toEqual([
      'cash',
      'accounts_receivable',
      'monthly_expenses',
    ])
    expect(metrics[0]).toMatchObject({
      value: 120000,
      currency: 'NZD',
      asOfDate: '2026-05-12',
      provenance: {
        sourceType: 'document',
        sourceLabel: 'financial-summary.csv',
        sourceId: 'document-123',
        evidence: {
          documentId: 'document-123',
          sourceRowStart: 1,
          sourceRowEnd: 1,
        },
      },
    })
  })

  it('returns no metrics when label and amount columns are missing', () => {
    const csvData: ParsedCsvData = {
      headers: ['Month', 'Notes'],
      rows: [
        {
          rowNumber: 1,
          values: ['April', 'Cash improved'],
          cells: {
            Month: 'April',
            Notes: 'Cash improved',
          },
        },
      ],
    }

    expect(
      extractCsvFinancialMetrics({
        csvData,
        documentId: 'document-123',
        sourceLabel: 'notes.csv',
        extractedAt: '2026-05-12T00:00:00.000Z',
      })
    ).toEqual([])
  })

  it('handles formatted and negative numeric values', () => {
    const csvData: ParsedCsvData = {
      headers: ['Metric', 'Balance'],
      rows: [
        {
          rowNumber: 1,
          values: ['Accounts Payable', '$12,500.50'],
          cells: {
            Metric: 'Accounts Payable',
            Balance: '$12,500.50',
          },
        },
        {
          rowNumber: 2,
          values: ['Monthly burn', '(8,400)'],
          cells: {
            Metric: 'Monthly burn',
            Balance: '(8,400)',
          },
        },
      ],
    }

    const metrics = extractCsvFinancialMetrics({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'summary.csv',
      defaultCurrency: 'NZD',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(metrics).toMatchObject([
      {
        key: 'accounts_payable',
        value: 12500.5,
        currency: 'NZD',
      },
      {
        key: 'burn_rate',
        value: -8400,
        currency: 'NZD',
      },
    ])
  })

  it('prioritises cash burn over the broader cash label', () => {
    const csvData: ParsedCsvData = {
      headers: ['Metric', 'Amount'],
      rows: [
        {
          rowNumber: 1,
          values: ['Cash burn', '17000'],
          cells: {
            Metric: 'Cash burn',
            Amount: '17000',
          },
        },
      ],
    }

    const [metric] = extractCsvFinancialMetrics({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'monthly-metrics.csv',
      defaultCurrency: 'NZD',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(metric).toMatchObject({
      key: 'burn_rate',
      value: 17000,
      currency: 'NZD',
    })
  })
})
