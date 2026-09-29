import { render, screen } from '@testing-library/react'
import { GenUiWidgetRenderer } from '@/app/dashboard/runway/gen-ui/GenUiWidgetRenderer'
import { GEN_UI_RENDERER_REGISTRY } from '@/app/dashboard/runway/gen-ui/renderer-registry'
import { GEN_UI_BUILDER_REGISTRY } from '@/lib/gen-ui/builders/registry'
import { GenUiWidgetSchema } from '@/lib/gen-ui/schema'
import {
  GEN_UI_WIDGET_TYPES,
  type GenUiWidget,
} from '@/lib/gen-ui/types'

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
