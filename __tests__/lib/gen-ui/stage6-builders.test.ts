import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import {
  buildCustomerRevenueBreakdownWidget,
  buildProductServiceRevenueWidget,
  revenueDimensionTypeForMessage,
} from '@/lib/gen-ui/builders/stage6/stage6-builders'
import type { GenUiDataContext } from '@/lib/gen-ui/builders/types'

function context(capabilities: string[], userMessage: string): GenUiDataContext {
  const metrics = fillUnavailableMetrics({})
  return {
    snapshot: { metrics, availableMetricCount: 0, unavailableMetricCount: 7, runwayInput: null, workingCapitalAdjustedRunway: metrics.runway_months },
    runwayTrend: { observations: [], direction: 'insufficient_data', change: null, averageChange: null },
    source: 'chat', selectedText: null, userMessage, metricHistories: [], metricForecasts: [], scenarioResult: null,
    stage3Data: { capabilities, accounts: [], reportingPeriods: [], transactions: [], budgets: [], invoices: [], debts: [], revenueEntries: [] },
  }
}

describe('Stage 6 widget builders', () => {
  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-30T12:00:00.000Z'))
  })
  afterAll(() => jest.useRealTimers())

  it('returns an honest unavailable state without customer-linked revenue', () => {
    const widget = buildCustomerRevenueBreakdownWidget({ type: 'customer_revenue_breakdown' }, 0, context([], 'revenue by customer'))
    expect(widget.state).toEqual({ status: 'unavailable', message: 'Customer-linked revenue entries are required for this breakdown.' })
  })

  it('treats a synced empty period as valid zero data', () => {
    const widget = buildCustomerRevenueBreakdownWidget(
      { type: 'customer_revenue_breakdown' }, 0, context(['customer_revenue'], 'customer revenue this month'),
    )
    expect(widget.state).toBeUndefined()
    if (widget.type !== 'customer_revenue_breakdown') throw new Error('Unexpected widget type')
    expect(widget.data.groups).toEqual([])
  })

  it('selects only explicitly requested dimension types', () => {
    expect(revenueDimensionTypeForMessage('revenue by department')).toBe('department')
    expect(revenueDimensionTypeForMessage('revenue by tracking category')).toBe('tracking')
    const widget = buildProductServiceRevenueWidget(
      { type: 'product_service_revenue' }, 0, context(['revenue_dimensions'], 'subscription revenue this year'),
    )
    if (widget.type !== 'product_service_revenue') throw new Error('Unexpected widget type')
    expect(widget.data.dimensionType).toBe('subscription')
  })
})
