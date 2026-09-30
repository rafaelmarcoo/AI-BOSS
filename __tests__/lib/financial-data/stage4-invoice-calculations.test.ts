import {
  summarizeInvoiceAgeing,
  summarizeOverdueInvoices,
  summarizeUpcomingInvoices,
} from '@/lib/financial-data/reporting/invoice-calculations'
import type { InvoiceWithDetails, Stage3FinancialData } from '@/lib/financial-data/reporting/types'

function invoice(params: {
  id: string
  dueDate: string
  amount?: number
  kind?: 'sales_invoice' | 'supplier_bill'
  status?: InvoiceWithDetails['status']
  currency?: string
  sourceLabel?: string
}): InvoiceWithDetails {
  return {
    id: params.id,
    user_id: 'user-1',
    connection_id: 'connection-1',
    document_id: null,
    sync_run_id: 'sync-1',
    source_type: 'xero',
    source_label: params.sourceLabel ?? 'Xero',
    provider_invoice_id: params.id,
    invoice_kind: params.kind ?? 'sales_invoice',
    status: params.status ?? 'authorised',
    invoice_number: params.id.toUpperCase(),
    counterparty_name: `Contact ${params.id}`,
    issue_date: '2026-01-01',
    due_date: params.dueDate,
    currency: params.currency ?? 'NZD',
    total_amount: params.amount ?? 100,
    amount_paid: 0,
    outstanding_amount: params.amount ?? 100,
    fully_paid_at: null,
    raw_data: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    lines: [],
    payments: [],
  }
}

function data(invoices: InvoiceWithDetails[]): Stage3FinancialData {
  return {
    capabilities: ['invoice_details', 'bill_details'],
    accounts: [],
    reportingPeriods: [],
    transactions: [],
    budgets: [],
    invoices,
  }
}

describe('Stage 4 invoice calculations', () => {
  const asOfDate = '2026-09-30'

  it('uses exact due-date ageing boundaries and excludes terminal invoices', () => {
    const result = summarizeInvoiceAgeing(data([
      invoice({ id: 'd30', dueDate: '2026-08-31', amount: 10 }),
      invoice({ id: 'd31', dueDate: '2026-08-30', amount: 20 }),
      invoice({ id: 'd60', dueDate: '2026-08-01', amount: 30 }),
      invoice({ id: 'd61', dueDate: '2026-07-31', amount: 40 }),
      invoice({ id: 'd90', dueDate: '2026-07-02', amount: 50 }),
      invoice({ id: 'd91', dueDate: '2026-07-01', amount: 60 }),
      invoice({ id: 'paid', dueDate: '2026-01-01', amount: 999, status: 'paid' }),
      invoice({ id: 'bill', dueDate: '2026-01-01', amount: 999, kind: 'supplier_bill' }),
    ]), asOfDate)

    expect(result).toHaveLength(1)
    expect(result[0].totalOutstanding).toBe(210)
    expect(result[0].buckets.map(({ count, amount }) => ({ count, amount }))).toEqual([
      { count: 1, amount: 10 },
      { count: 2, amount: 50 },
      { count: 2, amount: 90 },
      { count: 1, amount: 60 },
    ])
  })

  it('keeps source and currency totals separate', () => {
    const result = summarizeOverdueInvoices(data([
      invoice({ id: 'nzd', dueDate: '2026-09-01', amount: 100, currency: 'NZD' }),
      invoice({ id: 'aud', dueDate: '2026-09-01', amount: 80, currency: 'AUD' }),
      invoice({ id: 'other', dueDate: '2026-09-01', amount: 50, sourceLabel: 'Imported ledger' }),
    ]), asOfDate)

    expect(result).toHaveLength(3)
    expect(result.map((group) => [group.sourceLabel, group.currency, group.totalOutstanding])).toEqual([
      ['Xero', 'NZD', 100],
      ['Xero', 'AUD', 80],
      ['Imported ledger', 'NZD', 50],
    ])
  })

  it('includes only open balances due inside the selected future window', () => {
    const fixture = data([
      invoice({ id: 'today', dueDate: '2026-09-30', amount: 10 }),
      invoice({ id: 'day7', dueDate: '2026-10-07', amount: 20 }),
      invoice({ id: 'day8', dueDate: '2026-10-08', amount: 30 }),
      invoice({ id: 'overdue', dueDate: '2026-09-29', amount: 40 }),
      invoice({ id: 'bill7', dueDate: '2026-10-07', amount: 50, kind: 'supplier_bill' }),
    ])
    const payments = summarizeUpcomingInvoices({ data: fixture, kind: 'sales_invoice', asOfDate, horizonDays: 7 })
    const bills = summarizeUpcomingInvoices({ data: fixture, kind: 'supplier_bill', asOfDate, horizonDays: 7 })

    expect(payments[0]).toMatchObject({ count: 2, totalOutstanding: 30 })
    expect(payments[0].items.map((item) => item.id)).toEqual(['today', 'day7'])
    expect(bills[0]).toMatchObject({ count: 1, totalOutstanding: 50 })
  })
})
