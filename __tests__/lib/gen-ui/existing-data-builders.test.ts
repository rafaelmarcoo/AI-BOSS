import {
  buildAiFinancialBriefWidget,
  buildCashBalanceWidget,
  buildRevenueGrowthWidget,
  buildRevenueTrendWidgets,
} from '@/lib/gen-ui/builders/existing-data/existing-data-builders'
import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'
import type { GenUiDataContext } from '@/lib/gen-ui/builders/types'
import type { MetricHistorySummary } from '@/lib/financial-data/metric-history'

function metric(
  key: AvailableFinancialMetricValue['key'],
  value: number,
  date = '2026-08-31',
): AvailableFinancialMetricValue {
  return {
    status: 'available',
    key,
    value,
    currency: key === 'runway_months' ? null : 'NZD',
    periodStart: date.slice(0, 8) + '01',
    periodEnd: date,
    asOfDate: null,
    provenance: {
      sourceType: 'document',
      sourceLabel: 'verified.csv',
      sourceId: 'document-1',
    },
    confidence: 0.95,
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
}

function revenueHistory(values: number[]): MetricHistorySummary {
  return {
    metricKey: 'monthly_revenue',
    seriesKey: 'currency:NZD',
    label: 'Monthly revenue',
    range: 'all',
    points: values.map((value, index) => ({
      date: `2026-0${index + 6}-30`,
      dateSource: 'period_end',
      value,
      currency: 'NZD',
      sourceLabel: `month-${index + 1}.csv`,
      sourceType: 'document',
      confidence: 0.95,
      updatedAt: `2026-0${index + 7}-01T00:00:00.000Z`,
    })),
    movement: values.at(-1)! > values[0] ? 'increased' : 'decreased',
    direction: values.at(-1)! > values[0] ? 'improving' : 'worsening',
    firstValue: values[0],
    latestValue: values.at(-1)!,
    totalChange: values.at(-1)! - values[0],
    percentageChange: null,
    averageChange: null,
    currency: 'NZD',
    sourceLabels: values.map((_, index) => `month-${index + 1}.csv`),
    hasMixedSources: true,
    hasRecordedDateFallback: false,
    hasIncompatibleCurrencies: false,
    excludedCurrencyObservationCount: 0,
    hasMissingCurrencyObservations: false,
    unsupportedCurrencies: [],
  }
}

function context(params: {
  metrics?: AvailableFinancialMetricValue[]
  histories?: MetricHistorySummary[]
} = {}): GenUiDataContext {
  const metrics = fillUnavailableMetrics(Object.fromEntries(
    (params.metrics ?? []).map((item) => [item.key, item]),
  ))
  return {
    snapshot: {
      metrics,
      availableMetricCount: params.metrics?.length ?? 0,
      unavailableMetricCount: 7 - (params.metrics?.length ?? 0),
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
    userMessage: 'Financial question',
    metricHistories: params.histories ?? [],
    metricForecasts: [],
    scenarioResult: null,
  }
}

describe('Stage 2 existing-data builders', () => {
  it('keeps numeric cash data and source provenance', () => {
    const widget = buildCashBalanceWidget(
      { type: 'cash_balance' },
      0,
      context({ metrics: [metric('cash', 120000)] }),
    )

    expect(widget).toMatchObject({
      type: 'cash_balance',
      data: {
        value: 120000,
        currency: 'NZD',
        reportingDate: '2026-08-31',
        sourceLabel: 'verified.csv',
      },
    })
  })

  it('uses the latest two distinct history points for revenue growth', () => {
    const widget = buildRevenueGrowthWidget(
      { type: 'revenue_growth' },
      0,
      context({
        metrics: [metric('monthly_revenue', 150)],
        histories: [revenueHistory([100, 120, 150])],
      }),
    )

    expect(widget.data).toMatchObject({
      previousValue: 120,
      currentValue: 150,
      growthPercentage: 25,
      previousPeriod: '2026-07-30',
      currentPeriod: '2026-08-30',
      direction: 'up',
    })
  })

  it('returns an honest unavailable state when prior revenue is zero', () => {
    const widget = buildRevenueGrowthWidget(
      { type: 'revenue_growth' },
      0,
      context({ histories: [revenueHistory([0, 100])] }),
    )

    expect(widget.state).toEqual({
      status: 'unavailable',
      message: 'Revenue growth cannot be calculated from a zero-value prior period.',
    })
    expect(widget.data.growthPercentage).toBeNull()
  })

  it('marks a one-period trend unavailable', () => {
    const [widget] = buildRevenueTrendWidgets(
      { type: 'revenue_trend' },
      0,
      context({ histories: [revenueHistory([100])] }),
    )
    expect(widget.state?.status).toBe('unavailable')
  })

  it('builds brief facts only from traceable structured metrics', () => {
    const widget = buildAiFinancialBriefWidget(
      { type: 'ai_financial_brief' },
      0,
      context({
        metrics: [
          metric('cash', 120000),
          metric('monthly_revenue', 80000),
          metric('monthly_expenses', 65000),
        ],
      }),
    )

    expect(widget.data.facts).toHaveLength(3)
    expect(widget.data.facts.every((fact) => fact.sourceLabel === 'verified.csv')).toBe(true)
    expect(widget.data.summary).toContain('3 verified structured financial facts')
  })
})
