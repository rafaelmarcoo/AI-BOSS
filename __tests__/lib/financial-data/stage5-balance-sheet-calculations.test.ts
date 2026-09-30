import {
  summarizeBalanceSheetCategories,
  summarizeBalanceSheetMetrics,
  summarizeDebtOverview,
  summarizeDebtRepayments,
} from '@/lib/financial-data/reporting/balance-sheet-calculations'
import type { ReportingPeriodWithLines, Stage3FinancialData } from '@/lib/financial-data/reporting/types'
import type { FinancialStatementClassification, FinancialQuickRatioTreatment } from '@/types/database'

function line(params: {
  key: string
  label: string
  classification: FinancialStatementClassification
  amount: number
  treatment?: FinancialQuickRatioTreatment
  total?: boolean
}) {
  return {
    id: params.key, reporting_period_id: 'period-1', user_id: 'user-1', account_id: null,
    parent_line_id: null, line_key: params.key, label: params.label,
    classification: params.classification, canonical_category: params.key,
    amount: params.amount, cost_behavior: 'unclassified' as const,
    quick_ratio_treatment: params.treatment ?? 'not_applicable' as const,
    is_total: params.total ?? false, sort_order: 0, raw_data: {},
    created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z',
  }
}

function balancePeriod(lines: ReportingPeriodWithLines['lines']): ReportingPeriodWithLines {
  return {
    id: 'period-1', user_id: 'user-1', connection_id: 'connection-1', document_id: null,
    sync_run_id: 'sync-1', source_type: 'xero', source_label: 'Xero',
    statement_type: 'balance_sheet', period_start: '2026-09-30', period_end: '2026-09-30',
    currency: 'NZD', generated_at: '2026-09-30T00:00:00Z', raw_data: {},
    created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z', lines,
  }
}

function data(periods: ReportingPeriodWithLines[] = []): Stage3FinancialData {
  return { capabilities: ['balance_sheet', 'debt_details', 'debt_repayment_schedule'], accounts: [], reportingPeriods: periods, transactions: [], budgets: [], invoices: [], debts: [] }
}

describe('Stage 5 balance-sheet and debt calculations', () => {
  it('calculates liquidity metrics from classified components without double-counting totals', () => {
    const fixture = data([balancePeriod([
      line({ key: 'cash', label: 'Cash', classification: 'current_asset', amount: 40, treatment: 'include' }),
      line({ key: 'receivables', label: 'Receivables', classification: 'current_asset', amount: 30, treatment: 'include' }),
      line({ key: 'inventory', label: 'Inventory', classification: 'current_asset', amount: 30, treatment: 'exclude' }),
      line({ key: 'current-assets-total', label: 'Total current assets', classification: 'current_asset', amount: 100, treatment: 'unclassified', total: true }),
      line({ key: 'payables', label: 'Payables', classification: 'current_liability', amount: 50 }),
      line({ key: 'current-liabilities-total', label: 'Total current liabilities', classification: 'current_liability', amount: 50, total: true }),
    ])])

    expect(summarizeBalanceSheetMetrics(fixture)).toEqual([expect.objectContaining({
      currentAssets: 100,
      currentLiabilities: 50,
      workingCapital: 50,
      currentRatio: 2,
      quickAssets: 70,
      quickRatio: 1.4,
      quickRatioStatus: 'ready',
    })])
    expect(summarizeBalanceSheetCategories(fixture, 'assets')[0]).toMatchObject({
      total: 100,
      items: expect.arrayContaining([expect.objectContaining({ category: 'cash', amount: 40 })]),
    })
  })

  it('refuses to calculate the quick ratio when any current-asset component is unclassified', () => {
    const result = summarizeBalanceSheetMetrics(data([balancePeriod([
      line({ key: 'cash', label: 'Cash', classification: 'current_asset', amount: 40, treatment: 'include' }),
      line({ key: 'other', label: 'Other current asset', classification: 'current_asset', amount: 10, treatment: 'unclassified' }),
      line({ key: 'payables', label: 'Payables', classification: 'current_liability', amount: 25 }),
    ])]))[0]
    expect(result).toMatchObject({
      quickAssets: null,
      quickRatio: null,
      quickRatioStatus: 'unclassified_current_assets',
      unclassifiedQuickAssetCount: 1,
    })
  })

  it('does not interpret an aggregate-only current-asset total as zero quick assets', () => {
    const result = summarizeBalanceSheetMetrics(data([balancePeriod([
      line({ key: 'current-assets-total', label: 'Total current assets', classification: 'current_asset', amount: 50, total: true }),
      line({ key: 'payables', label: 'Payables', classification: 'current_liability', amount: 25 }),
    ])]))[0]
    expect(result).toMatchObject({ quickAssets: null, quickRatio: null, quickRatioStatus: 'unclassified_current_assets' })
  })

  it('keeps debt currencies separate and uses only stored scheduled repayments', () => {
    const fixture = data()
    fixture.debts = [{
      id: 'debt-1', user_id: 'user-1', connection_id: null, document_id: null, sync_run_id: null,
      source_type: 'manual', source_label: 'Manual', provider_debt_id: 'debt-1', debt_name: 'Term loan',
      lender_name: 'Bank', debt_type: 'loan', status: 'active', currency: 'NZD', original_principal: 1000,
      current_balance: 800, annual_interest_rate: 7.5, start_date: '2026-01-01', maturity_date: '2027-01-01',
      minimum_payment: 100, account_id: null, raw_data: {}, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      repayments: [{
        id: 'repayment-1', debt_id: 'debt-1', user_id: 'user-1', provider_repayment_id: 'r1',
        due_date: '2026-10-15', status: 'scheduled', principal_amount: 90, interest_amount: 10,
        total_amount: 100, paid_at: null, raw_data: {}, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      }],
    }]
    expect(summarizeDebtOverview(fixture)).toEqual([expect.objectContaining({ currency: 'NZD', totalBalance: 800 })])
    expect(summarizeDebtRepayments({ data: fixture, asOfDate: '2026-09-30', throughDate: '2026-12-31' }))
      .toEqual([expect.objectContaining({ totalScheduled: 100, repayments: [expect.objectContaining({ id: 'repayment-1' })] })])
  })
})
