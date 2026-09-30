import {
  calculateBreakEven,
  detectExpenseChanges,
  expenseBreakdown,
  forecastDatedValues,
  summarizeBudgetPerformance,
  summarizeCashFlowPeriods,
  summarizeProfitPeriods,
} from '@/lib/financial-data/reporting/calculations'
import type { Stage3FinancialData } from '@/lib/financial-data/reporting/types'

function dataFixture(): Stage3FinancialData {
  const period = (id: string, end: string, lines: Array<Record<string, unknown>>, statementType = 'profit_loss') => ({
    id, user_id: 'user-1', connection_id: 'connection-1', document_id: null, sync_run_id: null,
    source_type: 'xero', source_label: 'Xero', statement_type: statementType,
    period_start: `${end.slice(0, 8)}01`, period_end: end, currency: 'NZD', generated_at: null,
    raw_data: {}, created_at: end, updated_at: end,
    lines: lines.map((line, index) => ({
      id: `${id}-line-${index}`, reporting_period_id: id, user_id: 'user-1', account_id: null,
      parent_line_id: null, line_key: `${id}:${index}`, label: String(line.label ?? line.classification),
      classification: line.classification, canonical_category: line.category ?? null, amount: line.amount,
      cost_behavior: line.costBehavior ?? 'unclassified', is_total: line.isTotal ?? false,
      sort_order: index, raw_data: {}, created_at: end, updated_at: end,
    })),
  })
  return {
    capabilities: [],
    accounts: [], transactions: [],
    reportingPeriods: [
      period('p1', '2026-07-31', [
        { classification: 'revenue', amount: 100000, isTotal: true },
        { classification: 'cost_of_sales', amount: 30000, category: 'Materials', costBehavior: 'variable' },
        { classification: 'operating_expense', amount: 40000, category: 'Payroll', costBehavior: 'fixed' },
      ]),
      period('p2', '2026-08-31', [
        { classification: 'revenue', amount: 120000, isTotal: true },
        { classification: 'cost_of_sales', amount: 36000, category: 'Materials', costBehavior: 'variable' },
        { classification: 'operating_expense', amount: 42000, category: 'Payroll', costBehavior: 'fixed' },
      ]),
      period('cf1', '2026-07-31', [
        { classification: 'cash_inflow', amount: 90000, isTotal: true },
        { classification: 'cash_outflow', amount: 70000, isTotal: true },
      ], 'cash_flow'),
      period('cf2', '2026-08-31', [
        { classification: 'cash_inflow', amount: 100000, isTotal: true },
        { classification: 'cash_outflow', amount: 75000, isTotal: true },
      ], 'cash_flow'),
    ] as Stage3FinancialData['reportingPeriods'],
    budgets: [{
      id: 'budget-1', user_id: 'user-1', connection_id: 'connection-1', document_id: null,
      sync_run_id: null, source_type: 'xero', source_label: 'Xero', provider_budget_id: 'provider-budget',
      name: 'Operating budget', status: 'approved', period_start: '2026-08-01', period_end: '2026-08-31',
      currency: 'NZD', raw_data: {}, created_at: '2026-08-01', updated_at: '2026-08-01',
      lines: [{
        id: 'budget-line-1', budget_id: 'budget-1', user_id: 'user-1', account_id: null,
        line_key: 'payroll', label: 'Payroll', kind: 'expense', canonical_category: 'Payroll',
        period_start: '2026-08-01', period_end: '2026-08-31', amount: 45000,
        raw_data: {}, created_at: '2026-08-01', updated_at: '2026-08-01',
      }],
    }],
    invoices: [],
  }
}

describe('Stage 3 financial calculations', () => {
  it('keeps profit and cash flow as separate financial concepts', () => {
    const data = dataFixture()
    const profits = summarizeProfitPeriods(data)
    const cashFlows = summarizeCashFlowPeriods(data)

    expect(profits.at(-1)).toMatchObject({ revenue: 120000, grossProfit: 84000, operatingProfit: 42000 })
    expect(cashFlows.at(-1)).toMatchObject({ inflow: 100000, outflow: 75000, netCashFlow: 25000 })
  })

  it('calculates break-even only from explicitly classified costs', () => {
    const result = calculateBreakEven(dataFixture())
    expect(result.result).toMatchObject({ fixedCosts: 42000, variableCosts: 36000, contributionMarginRatio: 0.7, breakEvenRevenue: 60000 })

    const data = dataFixture()
    data.reportingPeriods.at(-3)!.lines.push({
      ...data.reportingPeriods.at(-3)!.lines[1], id: 'unclassified', line_key: 'unclassified',
      label: 'Other', classification: 'operating_expense', amount: 500, cost_behavior: 'unclassified',
    })
    expect(calculateBreakEven(data)).toMatchObject({ result: null, unclassifiedCostAmount: 500 })
  })

  it('builds category breakdowns and period changes without counting total rows twice', () => {
    const data = dataFixture()
    expect(expenseBreakdown(data)).toEqual([
      { category: 'Payroll', amount: 42000, percentage: 53.8 },
      { category: 'Materials', amount: 36000, percentage: 46.2 },
    ])
    expect(detectExpenseChanges(data)).toEqual([
      { category: 'Materials', currentAmount: 36000, previousAmount: 30000, change: 6000, percentageChange: 20 },
    ])
  })

  it('labels deterministic forecast points separately from actuals', () => {
    const result = forecastDatedValues([
      { date: '2026-06-30', value: 100, kind: 'actual' },
      { date: '2026-07-31', value: 110, kind: 'actual' },
      { date: '2026-08-31', value: 120, kind: 'actual' },
    ], 3)
    expect(result.points).toHaveLength(3)
    expect(result.points.every((point) => point.kind === 'forecast')).toBe(true)
    expect(result.assumptions).toContain('No currency conversion is performed.')
  })

  it('aligns budget lines with actual categories for the same period', () => {
    const summary = summarizeBudgetPerformance(dataFixture(), new Date('2026-08-16T00:00:00Z'))
    expect(summary).toMatchObject({ budgetName: 'Operating budget', totalBudget: 45000, totalActual: 42000, totalRemaining: 3000 })
  })
})
