import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import type { InvoiceWithDetails } from '@/lib/financial-data/reporting/types'
import {
  buildBillsDueWidget,
  buildOverdueInvoicesWidget,
} from '@/lib/gen-ui/builders/stage4/stage4-builders'
import type { GenUiDataContext } from '@/lib/gen-ui/builders/types'

function bill(): InvoiceWithDetails {
  return {
    id: 'bill-1', user_id: 'user-1', connection_id: 'connection-1', document_id: null,
    sync_run_id: 'sync-1', source_type: 'xero', source_label: 'Xero', provider_invoice_id: 'bill-1',
    invoice_kind: 'supplier_bill', status: 'authorised', invoice_number: 'BILL-001',
    counterparty_name: 'Supplier Ltd', issue_date: '2026-09-01', due_date: '2026-10-10',
    currency: 'NZD', total_amount: 500, amount_paid: 0, outstanding_amount: 500,
    fully_paid_at: null, raw_data: {}, created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z', lines: [], payments: [],
  }
}

function context(capabilities: string[], invoices: InvoiceWithDetails[] = []): GenUiDataContext {
  const metrics = fillUnavailableMetrics({})
  return {
    snapshot: {
      metrics, availableMetricCount: 0, unavailableMetricCount: 7,
      runwayInput: null, workingCapitalAdjustedRunway: metrics.runway_months,
    },
    runwayTrend: {
      observations: [], direction: 'insufficient_data', change: null, averageChange: null,
    },
    source: 'chat', selectedText: null, userMessage: 'bills due in 14 days',
    metricHistories: [], metricForecasts: [], scenarioResult: null,
    stage3Data: {
      capabilities, accounts: [], reportingPeriods: [], transactions: [], budgets: [], invoices, debts: [], revenueEntries: [],
    },
  }
}

describe('Stage 4 widget builders', () => {
  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-30T12:00:00.000Z'))
  })

  afterAll(() => jest.useRealTimers())

  it('returns unavailable when invoice-level capability was not synced', () => {
    const widget = buildOverdueInvoicesWidget({ type: 'overdue_invoices' }, 0, context([]))
    expect(widget.state).toEqual({
      status: 'unavailable',
      message: 'Detailed customer invoices are required for overdue analysis.',
    })
  })

  it('treats a synced empty result as a valid zero rather than missing data', () => {
    const widget = buildOverdueInvoicesWidget(
      { type: 'overdue_invoices' },
      0,
      context(['invoice_details']),
    )
    expect(widget.state).toBeUndefined()
    if (widget.type !== 'overdue_invoices') throw new Error('Unexpected widget type')
    expect(widget.data.groups).toEqual([])
  })

  it('honours the requested bills-due horizon', () => {
    const widget = buildBillsDueWidget(
      { type: 'bills_due' },
      0,
      context(['bill_details'], [bill()]),
    )
    expect(widget.type).toBe('bills_due')
    if (widget.type !== 'bills_due') throw new Error('Unexpected widget type')
    expect(widget.data).toMatchObject({
      asOfDate: '2026-09-30',
      throughDate: '2026-10-14',
      horizonDays: 14,
      groups: [{ count: 1, totalOutstanding: 500 }],
    })
  })
})
