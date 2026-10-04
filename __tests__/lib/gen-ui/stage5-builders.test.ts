import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import {
  buildDebtRepaymentTimelineWidget,
  buildQuickRatioWidget,
  buildWorkingCapitalWidget,
} from '@/lib/gen-ui/builders/stage5/stage5-builders'
import type { GenUiDataContext } from '@/lib/gen-ui/builders/types'

function context(capabilities: string[], userMessage = 'show working capital'): GenUiDataContext {
  const metrics = fillUnavailableMetrics({})
  return {
    snapshot: {
      metrics, availableMetricCount: 0, unavailableMetricCount: 7,
      runwayInput: null, workingCapitalAdjustedRunway: metrics.runway_months,
    },
    runwayTrend: { observations: [], direction: 'insufficient_data', change: null, averageChange: null },
    source: 'chat', selectedText: null, userMessage, metricHistories: [], metricForecasts: [], scenarioResult: null,
    stage3Data: { capabilities, accounts: [], reportingPeriods: [], transactions: [], budgets: [], invoices: [], debts: [], revenueEntries: [] },
  }
}

describe('Stage 5 widget builders', () => {
  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-30T12:00:00.000Z'))
  })

  afterAll(() => jest.useRealTimers())

  it('returns an honest unavailable state without a classified balance sheet', () => {
    const widget = buildWorkingCapitalWidget({ type: 'working_capital' }, 0, context([]))
    expect(widget.state).toEqual({ status: 'unavailable', message: 'A classified balance sheet is required for this calculation.' })
  })

  it('treats a synced empty balance sheet result as available rather than missing', () => {
    const widget = buildQuickRatioWidget({ type: 'quick_ratio' }, 0, context(['balance_sheet']))
    expect(widget.state).toBeUndefined()
    if (widget.type !== 'quick_ratio') throw new Error('Unexpected widget type')
    expect(widget.data.groups).toEqual([])
  })

  it('honours the requested debt timeline horizon without generating repayments', () => {
    const widget = buildDebtRepaymentTimelineWidget(
      { type: 'debt_repayment_timeline' },
      0,
      context(['debt_repayment_schedule'], 'show loan repayments for 12 months'),
    )
    if (widget.type !== 'debt_repayment_timeline') throw new Error('Unexpected widget type')
    expect(widget.data).toMatchObject({
      asOfDate: '2026-09-30', throughDate: '2027-09-30', horizonMonths: 12, groups: [],
    })
  })
})
