import { render, screen } from '@testing-library/react'
import { GenUiWidgetRenderer } from '@/app/dashboard/runway/gen-ui/GenUiWidgetRenderer'
import { GEN_UI_RENDERER_REGISTRY } from '@/app/dashboard/runway/gen-ui/renderer-registry'
import { GEN_UI_BUILDER_REGISTRY } from '@/lib/gen-ui/builders/registry'
import { GenUiWidgetSchema } from '@/lib/gen-ui/schema'
import {
  GEN_UI_WIDGET_TYPES,
  type GenUiWidget,
} from '@/lib/gen-ui/types'
import type { ScenarioAnalysisResult } from '@/lib/scenarios/calculation'

jest.mock('@/components/data-sources-panel', () => ({
  DataSourcesPanel: () => <div>Data sources</div>,
}))

const base = {
  id: 'widget-1',
  title: 'Registry fixture',
  reason: 'Verifies the registered renderer.',
}

const scenarioResult = {
  input: {
    sourceKey: 'document:doc-1',
    currency: 'NZD',
    horizon: 3,
    trendRange: '6m',
    manualBaseline: {},
    scenarios: [{
      id: 'baseline-change',
      label: 'Baseline change',
      adjustments: [{
        id: 'revenue-change',
        label: 'Revenue change',
        kind: 'fixed',
        flow: 'inflow',
        frequency: 'recurring',
        amount: 1000,
        startMonth: '2026-06',
      }],
    }],
  },
  currency: 'NZD',
  sourceKey: 'document:doc-1',
  sourceLabel: 'statement.csv',
  projectionStartMonth: '2026-06',
  openingLiquidity: 100000,
  openingBridge: {
    cash: 100000,
    accountsReceivable: 0,
    accountsPayable: 0,
    formula: '100000 + 0 - 0 = 100000',
  },
  panels: [{
    method: 'current_run_rate',
    label: 'Current run rate',
    available: true,
    unavailableReason: null,
    baselineMonthlyMovement: -10000,
    series: [],
  }],
  assumptions: [],
  warnings: [],
  metricInputs: {},
  calculatedAt: '2026-06-01T00:00:00Z',
} as unknown as ScenarioAnalysisResult

const stage3Summary = {
  currency: 'NZD', periodStart: '2026-08-01', periodEnd: '2026-08-31', sourceLabel: 'Xero',
  metrics: [{ label: 'Value', value: 1000, tone: 'neutral' as const }], note: 'Verified summary.',
}
const stage3Forecast = {
  label: 'Forecast', currency: 'NZD', actualPoints: [{ date: '2026-08-31', value: 1000 }],
  forecastPoints: [{ date: '2026-09-30', value: 1100 }], method: 'linear trend', assumptions: ['Test assumption.'],
}
const stage3Budget = {
  budgetName: 'Operating budget', currency: 'NZD', periodStart: '2026-07-01', periodEnd: '2027-06-30',
  totalBudget: 120000, totalActual: 50000, totalRemaining: 70000, projectedActual: 110000,
  projectedVariance: 10000, elapsedPercentage: 50,
  lines: [{ label: 'Software', budgetAmount: 12000, actualAmount: 5000, variance: 7000, remaining: 7000 }],
}
const stage4Group = {
  currency: 'NZD', sourceLabel: 'Xero', count: 1, totalOutstanding: 2500,
  items: [{
    id: 'invoice-1', invoiceNumber: 'INV-001', counterpartyName: 'Customer Ltd',
    issueDate: '2026-08-01', dueDate: '2026-08-31', outstandingAmount: 2500, daysOverdue: 30,
  }],
}
const stage5MetricGroup = {
  sourceLabel: 'Xero', currency: 'NZD', asOfDate: '2026-09-30',
  currentAssets: 100000, currentLiabilities: 50000, workingCapital: 50000,
  currentRatio: 2, quickAssets: 70000, quickRatio: 1.4,
  quickRatioStatus: 'ready' as const, unclassifiedQuickAssetCount: 0,
}
const stage5CategoryGroup = {
  sourceLabel: 'Xero', currency: 'NZD', asOfDate: '2026-09-30', total: 100000,
  items: [{ label: 'Cash', category: 'cash', amount: 100000, percentage: 100 }],
}

const widgets: GenUiWidget[] = [
  {
    ...base,
    type: 'metric_snapshot',
    data: { metrics: [] },
  },
  {
    ...base,
    type: 'data_connections',
    data: { message: 'Connect a source.' },
  },
  {
    ...base,
    type: 'metric_trend_chart',
    data: {
      metricKey: 'cash',
      label: 'Cash',
      currency: 'NZD',
      points: [],
      direction: 'insufficient_data',
      totalChange: null,
      hasMixedSources: false,
      hasRecordedDateFallback: false,
      note: 'No history yet.',
    },
  },
  {
    ...base,
    type: 'metric_forecast_chart',
    data: {
      metricKey: 'cash',
      label: 'Cash',
      currency: 'NZD',
      actualPoints: [],
      forecastPoints: [],
      horizon: 3,
      monthlySlope: 0,
      hasMixedSources: false,
      hasRecordedDateFallback: false,
      note: 'No forecast yet.',
    },
  },
  {
    ...base,
    type: 'scenario_comparison',
    data: {
      currency: 'NZD',
      base: { label: 'Current', monthlyBurn: 10000, runwayMonths: 10 },
      scenarios: [],
      note: 'Legacy comparison.',
    },
  },
  {
    ...base,
    type: 'scenario_analysis',
    data: { result: scenarioResult, editHref: '/dashboard/scenarios' },
  },
  {
    ...base,
    type: 'planning_checklist',
    data: { items: [] },
  },
  {
    ...base,
    type: 'risk_threshold_timeline',
    data: {
      currentRunway: null,
      monthsUntilCaution: null,
      monthsUntilUrgent: null,
      status: 'unknown',
      message: 'Runway unavailable.',
    },
  },
  {
    ...base,
    type: 'metric_source_evidence',
    data: { metrics: [] },
  },
  {
    ...base,
    type: 'missing_data_panel',
    data: { missingMetrics: ['Cash'], message: 'Cash is unavailable.' },
  },
  {
    ...base,
    type: 'highlight_explainer',
    data: { selectedText: 'Runway', prompt: 'Explain runway.' },
  },
  {
    ...base,
    type: 'cash_balance',
    data: {
      metricKey: 'cash', label: 'Cash', value: 120000, currency: 'NZD',
      reportingDate: '2026-08-31', periodStart: null, periodEnd: null,
      sourceLabel: 'verified.csv', sourceType: 'document', confidence: 0.95,
    },
  },
  {
    ...base,
    type: 'revenue_snapshot',
    data: {
      metricKey: 'monthly_revenue', label: 'Monthly revenue', value: 80000, currency: 'NZD',
      reportingDate: '2026-08-31', periodStart: '2026-08-01', periodEnd: '2026-08-31',
      sourceLabel: 'verified.csv', sourceType: 'document', confidence: 0.95,
    },
  },
  {
    ...base,
    type: 'revenue_trend',
    data: {
      metricKey: 'monthly_revenue', label: 'Monthly revenue', currency: 'NZD',
      points: [], direction: 'insufficient_data', change: null, percentageChange: null,
      periodStart: null, periodEnd: null, note: 'No history yet.',
    },
  },
  {
    ...base,
    type: 'revenue_growth',
    data: {
      currentValue: 120, previousValue: 100, growthPercentage: 20, currency: 'NZD',
      currentPeriod: '2026-08-31', previousPeriod: '2026-07-31', direction: 'up',
      sourceLabels: ['verified.csv'],
    },
  },
  {
    ...base,
    type: 'expense_summary',
    data: {
      metricKey: 'monthly_expenses', label: 'Monthly expenses', value: 65000, currency: 'NZD',
      reportingDate: '2026-08-31', periodStart: '2026-08-01', periodEnd: '2026-08-31',
      sourceLabel: 'verified.csv', sourceType: 'document', confidence: 0.95,
    },
  },
  {
    ...base,
    type: 'expense_trend',
    data: {
      metricKey: 'monthly_expenses', label: 'Monthly expenses', currency: 'NZD',
      points: [], direction: 'insufficient_data', change: null, percentageChange: null,
      periodStart: null, periodEnd: null, note: 'No history yet.',
    },
  },
  {
    ...base,
    type: 'accounts_receivable',
    data: {
      metricKey: 'accounts_receivable', label: 'Accounts receivable', value: 25000, currency: 'NZD',
      reportingDate: '2026-08-31', periodStart: null, periodEnd: null,
      sourceLabel: 'verified.csv', sourceType: 'document', confidence: 0.95,
    },
  },
  {
    ...base,
    type: 'accounts_payable',
    data: {
      metricKey: 'accounts_payable', label: 'Accounts payable', value: 18000, currency: 'NZD',
      reportingDate: '2026-08-31', periodStart: null, periodEnd: null,
      sourceLabel: 'verified.csv', sourceType: 'document', confidence: 0.95,
    },
  },
  {
    ...base,
    type: 'ai_financial_brief',
    data: {
      summary: 'Based on one verified fact.',
      facts: [{
        label: 'Cash balance', value: 'NZD 120,000', detail: 'Latest trusted cash.',
        tone: 'neutral', sourceLabel: 'verified.csv',
      }],
    },
  },
  { ...base, type: 'cash_flow_summary', data: stage3Summary },
  { ...base, type: 'cash_flow_forecast', data: { ...stage3Forecast, openingCash: 100000, horizonDays: 30 } },
  { ...base, type: 'revenue_forecast', data: stage3Forecast },
  { ...base, type: 'profit_snapshot', data: stage3Summary },
  { ...base, type: 'profit_trend', data: { ...stage3Forecast, forecastPoints: [], profitType: 'operating' } },
  { ...base, type: 'profit_forecast', data: { ...stage3Forecast, profitType: 'operating' } },
  { ...base, type: 'profit_margin', data: { ...stage3Summary, marginType: 'operating' } },
  {
    ...base, type: 'break_even_analysis', data: {
      currency: 'NZD', revenue: 100000, fixedCosts: 40000, variableCosts: 30000,
      contributionMarginPercentage: 70, breakEvenRevenue: 57142.86, unclassifiedCostAmount: 0, note: 'Classified costs.',
    },
  },
  {
    ...base, type: 'break_even_progress', data: {
      currency: 'NZD', currentRevenue: 100000, breakEvenRevenue: 57142.86,
      progressPercentage: 175, remainingRevenue: 0, note: 'Above break-even.',
    },
  },
  {
    ...base, type: 'expense_breakdown', data: {
      currency: 'NZD', periodStart: '2026-08-01', periodEnd: '2026-08-31',
      categories: [{ label: 'Software', amount: 1000, percentage: 100 }],
    },
  },
  {
    ...base, type: 'largest_expenses', data: {
      currency: 'NZD', items: [{ id: 'expense-1', label: 'Hosting', counterparty: 'Cloud Co', date: '2026-08-20', amount: 1000, category: 'Software' }],
    },
  },
  {
    ...base, type: 'expense_change_detector', data: {
      currency: 'NZD', changes: [{ category: 'Software', currentAmount: 1200, previousAmount: 1000, change: 200, percentageChange: 20 }],
    },
  },
  { ...base, type: 'budget_vs_actual', data: stage3Budget },
  { ...base, type: 'budget_remaining', data: stage3Budget },
  { ...base, type: 'budget_forecast', data: { ...stage3Budget, method: 'run rate', assumptions: ['Test assumption.'] } },
  { ...base, type: 'cash_inflow_forecast', data: stage3Forecast },
  { ...base, type: 'cash_outflow_forecast', data: stage3Forecast },
  { ...base, type: 'overdue_invoices', data: { asOfDate: '2026-09-30', groups: [stage4Group], note: 'Past due.' } },
  {
    ...base, type: 'invoice_ageing', data: {
      asOfDate: '2026-09-30', note: 'Aged from due dates.', groups: [{
        currency: 'NZD', sourceLabel: 'Xero', totalOutstanding: 2500,
        buckets: [
          { key: 'days_0_30', label: '0–30 days', count: 1, amount: 2500, percentage: 100 },
          { key: 'days_31_60', label: '31–60 days', count: 0, amount: 0, percentage: 0 },
          { key: 'days_61_90', label: '61–90 days', count: 0, amount: 0, percentage: 0 },
          { key: 'days_90_plus', label: '90+ days', count: 0, amount: 0, percentage: 0 },
        ],
      }],
    },
  },
  {
    ...base, type: 'expected_payments', data: {
      asOfDate: '2026-09-30', throughDate: '2026-10-30', horizonDays: 30,
      groups: [stage4Group], method: 'Stored invoice due dates', note: 'Expected, not guaranteed.',
    },
  },
  {
    ...base, type: 'bills_due', data: {
      asOfDate: '2026-09-30', throughDate: '2026-10-14', horizonDays: 14,
      groups: [stage4Group], note: 'Open supplier bills.',
    },
  },
  { ...base, type: 'working_capital', data: { groups: [stage5MetricGroup], formula: 'Current assets − current liabilities', note: 'No FX conversion.' } },
  { ...base, type: 'current_ratio', data: { groups: [stage5MetricGroup], formula: 'Current assets ÷ current liabilities', note: 'Classified inputs.' } },
  { ...base, type: 'quick_ratio', data: { groups: [stage5MetricGroup], formula: 'Quick assets ÷ current liabilities', note: 'Explicit treatments.' } },
  { ...base, type: 'asset_summary', data: { groups: [stage5CategoryGroup], note: 'Component lines.' } },
  { ...base, type: 'liability_summary', data: { groups: [stage5CategoryGroup], note: 'Component lines.' } },
  { ...base, type: 'equity_snapshot', data: { groups: [stage5CategoryGroup], note: 'Component lines.' } },
  {
    ...base, type: 'debt_overview', data: {
      groups: [{
        sourceLabel: 'Manual', currency: 'NZD', totalBalance: 80000,
        debts: [{ id: 'debt-1', name: 'Term loan', lenderName: 'Bank', debtType: 'loan', currentBalance: 80000, annualInterestRate: 7.5, maturityDate: '2027-09-30', minimumPayment: 2000 }],
      }],
      note: 'Stored debts only.',
    },
  },
  {
    ...base, type: 'debt_repayment_timeline', data: {
      asOfDate: '2026-09-30', throughDate: '2026-12-30', horizonMonths: 3,
      groups: [{
        sourceLabel: 'Manual', currency: 'NZD', totalScheduled: 2000,
        repayments: [{ id: 'repayment-1', debtName: 'Term loan', dueDate: '2026-10-15', principalAmount: 1800, interestAmount: 200, totalAmount: 2000 }],
      }],
      note: 'Stored dates only.',
    },
  },
]

describe('Gen UI registries', () => {
  it('requires a renderer and builder for every widget type', () => {
    expect(Object.keys(GEN_UI_RENDERER_REGISTRY)).toEqual(GEN_UI_WIDGET_TYPES)
    expect(Object.keys(GEN_UI_BUILDER_REGISTRY)).toEqual(GEN_UI_WIDGET_TYPES)
  })

  it.each(widgets)('validates and renders $type', (widget) => {
    expect(GenUiWidgetSchema.safeParse(widget).success).toBe(true)

    const { unmount } = render(
      <GenUiWidgetRenderer widget={widget} onAskChatbot={jest.fn()} />,
    )

    expect(screen.getByText('Registry fixture')).toBeInTheDocument()
    unmount()
  })

  it.each(['loading', 'partial', 'unavailable', 'error'] as const)(
    'renders the shared %s state',
    (status) => {
      const widget: GenUiWidget = {
        ...base,
        type: 'planning_checklist',
        state: { status, message: `${status} state` },
        data: { items: [] },
      }

      expect(GenUiWidgetSchema.safeParse(widget).success).toBe(true)
      render(<GenUiWidgetRenderer widget={widget} onAskChatbot={jest.fn()} />)
      expect(screen.getByText(new RegExp(`${status} state`, 'i'))).toBeInTheDocument()
    },
  )
})
