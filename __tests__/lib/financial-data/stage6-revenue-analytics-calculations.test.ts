import {
  resolveRevenueAnalyticsPeriod,
  summarizeCustomerConcentration,
  summarizeCustomerRevenue,
  summarizeRevenueByDimension,
} from '@/lib/financial-data/reporting/revenue-analytics-calculations'
import type { RevenueEntryWithDetails, Stage3FinancialData } from '@/lib/financial-data/reporting/types'

function revenueEntry(params: {
  id: string
  amount: number
  date?: string
  customer?: { id: string; name: string } | null
  dimension?: { id: string; name: string; type?: 'product_service' | 'tracking'; group?: string } | null
  currency?: string
  sourceLabel?: string
}): RevenueEntryWithDetails {
  const customer = params.customer ? {
    id: params.customer.id, user_id: 'user-1', connection_id: null, document_id: null, sync_run_id: null,
    source_type: 'xero' as const, source_label: params.sourceLabel ?? 'Xero', provider_customer_id: params.customer.id,
    customer_name: params.customer.name, status: 'active' as const, raw_data: {},
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  } : null
  const dimension = params.dimension ? {
    id: params.dimension.id, user_id: 'user-1', connection_id: null, document_id: null, sync_run_id: null,
    source_type: 'xero' as const, source_label: params.sourceLabel ?? 'Xero', provider_dimension_id: params.dimension.id,
    dimension_type: params.dimension.type ?? 'product_service' as const,
    dimension_group: params.dimension.group ?? 'default', dimension_name: params.dimension.name,
    status: 'active' as const, raw_data: {}, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  } : null
  return {
    id: params.id, user_id: 'user-1', connection_id: null, document_id: null, sync_run_id: null,
    source_type: 'xero', source_label: params.sourceLabel ?? 'Xero', provider_revenue_id: params.id,
    revenue_date: params.date ?? '2026-09-15', status: 'posted', currency: params.currency ?? 'NZD',
    amount: params.amount, customer_id: customer?.id ?? null, invoice_id: null, transaction_id: null,
    description: null, raw_data: {}, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    customer,
    dimensions: dimension ? [{
      id: `link-${params.id}`, revenue_entry_id: params.id, user_id: 'user-1', dimension_id: dimension.id,
      dimension_type: dimension.dimension_type, dimension_group: dimension.dimension_group, raw_data: {},
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', dimension,
    }] : [],
  }
}

function data(entries: RevenueEntryWithDetails[]): Stage3FinancialData {
  return {
    capabilities: ['customer_revenue', 'revenue_dimensions'], accounts: [], reportingPeriods: [],
    transactions: [], budgets: [], invoices: [], debts: [], revenueEntries: entries,
  }
}

describe('Stage 6 revenue analytics calculations', () => {
  const period = { periodStart: '2026-07-01', periodEnd: '2026-09-30', label: 'Last 3 months' }

  it('resolves explicit reporting periods with inclusive boundaries', () => {
    expect(resolveRevenueAnalyticsPeriod('show the last 3 months', '2026-09-30')).toEqual(period)
    expect(resolveRevenueAnalyticsPeriod('year to date', '2026-09-30')).toEqual({
      periodStart: '2026-01-01', periodEnd: '2026-09-30', label: 'Year to date',
    })
  })

  it('ranks customers and keeps unallocated revenue in the concentration denominator', () => {
    const fixture = data([
      revenueEntry({ id: 'a', amount: 500, customer: { id: 'a', name: 'Alpha' } }),
      revenueEntry({ id: 'b', amount: 300, customer: { id: 'b', name: 'Beta' } }),
      revenueEntry({ id: 'unallocated', amount: 200, customer: null }),
      revenueEntry({ id: 'outside', amount: 999, date: '2026-06-30', customer: { id: 'c', name: 'Outside' } }),
    ])
    expect(summarizeCustomerRevenue(fixture, period)[0]).toMatchObject({
      totalRevenue: 1000, allocatedRevenue: 800, unallocatedRevenue: 200,
      items: [{ customerName: 'Alpha', revenue: 500, percentage: 50 }, { customerName: 'Beta', revenue: 300, percentage: 30 }],
    })
    expect(summarizeCustomerConcentration(fixture, period)[0]).toMatchObject({
      status: 'partial_unallocated', riskLevel: 'high', topCustomerPercentage: 50, topThreePercentage: 80,
    })
  })

  it('groups one stored dimension axis without inventing missing classifications', () => {
    const fixture = data([
      revenueEntry({ id: 'consulting', amount: 600, customer: null, dimension: { id: 'consulting', name: 'Consulting' } }),
      revenueEntry({ id: 'support', amount: 200, customer: null, dimension: { id: 'support', name: 'Support' } }),
      revenueEntry({ id: 'unallocated', amount: 200, customer: null, dimension: null }),
    ])
    expect(summarizeRevenueByDimension({ data: fixture, period, dimensionType: 'product_service' })[0]).toMatchObject({
      dimensionGroup: 'default', totalRevenue: 1000, allocatedRevenue: 800, unallocatedRevenue: 200,
      items: [{ name: 'Consulting', revenue: 600, percentage: 60 }, { name: 'Support', revenue: 200, percentage: 20 }],
    })
  })

  it('does not call fully unallocated customer revenue diversified', () => {
    const result = summarizeCustomerConcentration(data([
      revenueEntry({ id: 'unallocated', amount: 500, customer: null }),
    ]), period)[0]
    expect(result).toMatchObject({
      status: 'unavailable_no_customer_mapping',
      riskLevel: 'unavailable',
      topCustomerPercentage: null,
    })
  })

  it('never combines sources or currencies', () => {
    const groups = summarizeCustomerRevenue(data([
      revenueEntry({ id: 'nzd', amount: 100, customer: { id: 'a', name: 'Alpha' } }),
      revenueEntry({ id: 'aud', amount: 80, currency: 'AUD', customer: { id: 'a', name: 'Alpha' } }),
      revenueEntry({ id: 'manual', amount: 50, sourceLabel: 'Manual', customer: { id: 'a', name: 'Alpha' } }),
    ]), period)
    expect(groups.map((group) => [group.sourceLabel, group.currency, group.totalRevenue])).toEqual([
      ['Xero', 'NZD', 100], ['Xero', 'AUD', 80], ['Manual', 'NZD', 50],
    ])
  })
})
