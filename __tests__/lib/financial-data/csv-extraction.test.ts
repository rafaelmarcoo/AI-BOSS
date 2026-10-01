import {
  extractCsvFinancialData,
  extractCsvFinancialMetrics,
} from '@/lib/financial-data/extraction/csv'
import type { ParsedCsvData } from '@/lib/documents/types'

function row(rowNumber: number, cells: Record<string, string>) {
  return { rowNumber, values: Object.values(cells), cells }
}

describe('extractCsvFinancialData', () => {
  it('extracts canonical metrics from row-label CSV data', () => {
    const csvData: ParsedCsvData = {
      headers: ['Account', 'Amount', 'Currency', 'Date'],
      rows: [
        row(1, { Account: 'Cash at bank', Amount: '120000', Currency: 'NZD', Date: '2026-05-12' }),
        row(2, { Account: 'Debtors', Amount: '45000', Currency: 'NZD', Date: '2026-05-12' }),
        row(3, { Account: 'Operating expenses', Amount: '52000', Currency: 'NZD', Date: '2026-04-30' }),
      ],
    }

    const { metrics } = extractCsvFinancialData({
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
      rows: [row(1, { Month: 'April', Notes: 'Cash improved' })],
    }

    expect(
      extractCsvFinancialData({
        csvData,
        documentId: 'document-123',
        sourceLabel: 'notes.csv',
        extractedAt: '2026-05-12T00:00:00.000Z',
      })
    ).toEqual({ metrics: [], customMetrics: {}, items: [], itemAttributes: {} })
  })

  it('handles formatted and negative numeric values', () => {
    const csvData: ParsedCsvData = {
      headers: ['Metric', 'Balance'],
      rows: [
        row(1, { Metric: 'Accounts Payable', Balance: '$12,500.50' }),
        row(2, { Metric: 'Monthly burn', Balance: '(8,400)' }),
      ],
    }

    const { metrics } = extractCsvFinancialData({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'summary.csv',
      defaultCurrency: 'NZD',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(metrics).toMatchObject([
      { key: 'accounts_payable', value: 12500.5, currency: 'NZD' },
      { key: 'burn_rate', value: -8400, currency: 'NZD' },
    ])
  })

  it('prioritises cash burn over the broader cash label', () => {
    const csvData: ParsedCsvData = {
      headers: ['Metric', 'Amount'],
      rows: [row(1, { Metric: 'Cash burn', Amount: '17000' })],
    }

    const { metrics } = extractCsvFinancialData({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'monthly-metrics.csv',
      defaultCurrency: 'NZD',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(metrics[0]).toMatchObject({
      key: 'burn_rate',
      value: 17000,
      currency: 'NZD',
    })
  })

  it('sums multiple rows that match the same additive metric instead of keeping only the first', () => {
    const csvData: ParsedCsvData = {
      headers: ['Metric', 'Value'],
      rows: [
        row(1, { Metric: 'Icecream Revenue', Value: '500' }),
        row(2, { Metric: 'Pumpkin Revenue', Value: '300' }),
      ],
    }

    const { metrics } = extractCsvFinancialData({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'revenue.csv',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({ key: 'monthly_revenue', value: 800 })
  })

  it('keeps only the first match for non-additive metrics like runway', () => {
    const csvData: ParsedCsvData = {
      headers: ['Metric', 'Value'],
      rows: [
        row(1, { Metric: 'Runway', Value: '6' }),
        row(2, { Metric: 'Runway months', Value: '9' }),
      ],
    }

    const { metrics } = extractCsvFinancialData({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'runway.csv',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({ key: 'runway_months', value: 6 })
  })

  it('captures unrecognized labels as custom metrics instead of dropping them', () => {
    const csvData: ParsedCsvData = {
      headers: ['Metric', 'Value'],
      rows: [
        row(1, { Metric: 'Monthly Revenue', Value: '1000' }),
        row(2, { Metric: 'Marketing Spend', Value: '250' }),
      ],
    }

    const { metrics, customMetrics } = extractCsvFinancialData({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'mixed.csv',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

    expect(metrics).toMatchObject([{ key: 'monthly_revenue', value: 1000 }])
    expect(customMetrics).toEqual({ 'Marketing Spend': 250 })
  })

  const extract = (csvData: ParsedCsvData) =>
    extractCsvFinancialData({
      csvData,
      documentId: 'document-123',
      sourceLabel: 'items.csv',
      extractedAt: '2026-05-12T00:00:00.000Z',
    })

  it('turns extra columns into attributes on each item', () => {
    const { items, itemAttributes } = extract({
      headers: ['Item', 'Amount', 'Department', 'Warehouse'],
      rows: [
        row(1, { Item: 'Icecream', Amount: '500', Department: 'A', Warehouse: '1' }),
        row(2, { Item: 'Pumpkin', Amount: '300', Department: 'B', Warehouse: '001' }),
      ],
    })

    expect(items).toEqual([
      { label: 'Icecream', value: 500, attributes: { Department: 'A', Warehouse: 1 } },
      // "001" stays text so an identifier isn't turned into a different number.
      { label: 'Pumpkin', value: 300, attributes: { Department: 'B', Warehouse: '001' } },
    ])
    expect(itemAttributes.Icecream).toEqual({ Department: 'A', Warehouse: 1 })
  })

  it('computes price x quantity when there is no amount column and keeps price, quantity and total', () => {
    const { items, customMetrics } = extract({
      headers: ['Item', 'Price', 'Quantity', 'Department'],
      rows: [row(1, { Item: 'Icecream', Price: '15', Quantity: '34', Department: 'A' })],
    })

    expect(items).toEqual([
      {
        label: 'Icecream',
        value: 510,
        attributes: { Price: 15, Quantity: 34, Department: 'A', total: 510 },
      },
    ])
    expect(customMetrics).toEqual({ Icecream: 510 })
  })

  it('keeps a stated amount over price x quantity, and only computes into an empty amount cell', () => {
    const { items } = extract({
      headers: ['Item', 'Amount', 'Price', 'Quantity'],
      rows: [
        row(1, { Item: 'Stated', Amount: '600', Price: '15', Quantity: '34' }),
        row(2, { Item: 'Empty', Amount: '', Price: '15', Quantity: '34' }),
        row(3, { Item: 'Bad', Amount: 'egg', Price: '15', Quantity: '34' }),
      ],
    })

    expect(items.map((item) => [item.label, item.value])).toEqual([
      ['Stated', 600],
      ['Empty', 510],
    ])
  })

  it('keeps repeated labels as separate items and never overwrites the first in the simple map', () => {
    const { items, customMetrics, itemAttributes } = extract({
      headers: ['Item', 'Amount', 'Department'],
      rows: [
        row(1, { Item: 'Icecream', Amount: '500', Department: 'A' }),
        row(2, { Item: 'Icecream', Amount: '300', Department: 'B' }),
      ],
    })

    expect(items).toHaveLength(2)
    expect(customMetrics).toEqual({ Icecream: 500 })
    expect(itemAttributes).toEqual({ Icecream: { Department: 'A' } })
  })

  it('lists rows that feed a fixed metric as items too, with their attributes', () => {
    const { metrics, items } = extract({
      headers: ['Metric', 'Value', 'Department'],
      rows: [
        row(1, { Metric: 'Revenue', Value: '500', Department: 'A' }),
        row(2, { Metric: 'Revenue', Value: '300', Department: 'B' }),
      ],
    })

    expect(metrics).toMatchObject([{ key: 'monthly_revenue', value: 800 }])
    expect(items).toHaveLength(2)
  })

  it('returns nothing when there is no label column', () => {
    const result = extract({
      headers: ['Foo', 'Bar'],
      rows: [row(1, { Foo: 'x', Bar: '1' })],
    })

    expect(result).toEqual({ metrics: [], customMetrics: {}, items: [], itemAttributes: {} })
  })
})

describe('extractCsvFinancialMetrics', () => {
  // main's document-review candidate builder calls this function by name and
  // uses the result directly as an array (`metrics.map(...)`). This is the
  // one contract that must never change shape, so it gets its own test.
  it('returns a plain array of metrics, not the full items/attributes result', () => {
    const csvData: ParsedCsvData = {
      headers: ['Account', 'Amount'],
      rows: [row(1, { Account: 'Cash at bank', Amount: '120000' })],
    }
    const params = {
      csvData,
      documentId: 'document-123',
      sourceLabel: 'financial-summary.csv',
      extractedAt: '2026-05-12T00:00:00.000Z',
    }

    const metrics = extractCsvFinancialMetrics(params)

    expect(Array.isArray(metrics)).toBe(true)
    expect(metrics).toEqual(extractCsvFinancialData(params).metrics)
    expect(metrics.map((metric) => metric.key)).toEqual(['cash'])
  })
})
