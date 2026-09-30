import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import type { Stage3FinancialData } from '@/lib/financial-data/reporting/types'
import {
  buildProfitMarginWidget,
  buildProfitTrendWidget,
} from '@/lib/gen-ui/builders/stage3/stage3-builders'
import type { GenUiDataContext } from '@/lib/gen-ui/builders/types'

function reportingPeriod(
  id: string,
  end: string,
  revenue: number,
  costOfSales: number,
  operatingExpenses: number,
): Stage3FinancialData['reportingPeriods'][number] {
  const lines = [
    { classification: 'revenue', amount: revenue, isTotal: true },
    { classification: 'cost_of_sales', amount: costOfSales, isTotal: false },
    { classification: 'operating_expense', amount: operatingExpenses, isTotal: false },
  ] as const
  return {
    id,
    user_id: 'user-1',
    connection_id: 'connection-1',
    document_id: null,
    sync_run_id: null,
    source_type: 'xero',
    source_label: 'Xero',
    statement_type: 'profit_loss',
    period_start: `${end.slice(0, 8)}01`,
    period_end: end,
    currency: 'NZD',
    generated_at: null,
    raw_data: {},
    created_at: end,
    updated_at: end,
    lines: lines.map((line, index) => ({
      id: `${id}-${index}`,
      reporting_period_id: id,
      user_id: 'user-1',
      account_id: null,
      parent_line_id: null,
      line_key: `${id}:${index}`,
      label: line.classification,
      classification: line.classification,
      canonical_category: null,
      amount: line.amount,
      cost_behavior: 'unclassified',
      is_total: line.isTotal,
      sort_order: index,
      raw_data: {},
      created_at: end,
      updated_at: end,
    })),
  }
}

function context(): GenUiDataContext {
  const metrics = fillUnavailableMetrics({})
  return {
    snapshot: {
      metrics,
      availableMetricCount: 0,
      unavailableMetricCount: 7,
      runwayInput: null,
      workingCapitalAdjustedRunway: metrics.runway_months,
    },
    runwayTrend: {
      observations: [],
      direction: 'insufficient_data',
      change: null,
      averageChange: null,
      workingCapitalAdjusted: {
        observations: [],
        direction: 'insufficient_data',
        change: null,
        averageChange: null,
      },
    },
    source: 'chat',
    selectedText: null,
    userMessage: 'Show operating profit and margin',
    metricHistories: [],
    metricForecasts: [],
    scenarioResult: null,
    stage3Data: {
      accounts: [],
      reportingPeriods: [
        reportingPeriod('p1', '2026-07-31', 100000, 30000, 40000),
        reportingPeriod('p2', '2026-08-31', 120000, 36000, 42000),
      ],
      transactions: [],
      budgets: [],
    },
  }
}

describe('Stage 3 widget builders', () => {
  it('distinguishes forecast points from actual profit trend points', () => {
    const widget = buildProfitTrendWidget({ type: 'profit_trend' }, 0, context())

    expect(widget.type).toBe('profit_trend')
    if (widget.type !== 'profit_trend') throw new Error('Unexpected widget type')
    expect(widget.data.actualPoints).toHaveLength(2)
    expect(widget.data.forecastPoints).toHaveLength(3)
    expect(widget.data.method).toBe('date-aware linear trend')
  })

  it('compares the current profit margin with the previous aligned period', () => {
    const widget = buildProfitMarginWidget({ type: 'profit_margin' }, 0, context())

    expect(widget.type).toBe('profit_margin')
    if (widget.type !== 'profit_margin') throw new Error('Unexpected widget type')
    expect(widget.data.metrics[0]).toMatchObject({
      percentage: 35,
      comparisonPercentage: 5,
      comparisonLabel: 'vs period ending 2026-07-31',
    })
  })
})
