import { listStage3WidgetCandidates, selectStage3FallbackSpecs } from '@/lib/gen-ui/stage3-selection'

describe('Stage 3 widget selection', () => {
  it.each([
    ['show my cash flow', 'cash_flow_summary'],
    ['forecast cash flow for 90 days', 'cash_flow_forecast'],
    ['forecast revenue', 'revenue_forecast'],
    ['show net profit margin', 'profit_margin'],
    ['show gross profit trend', 'profit_trend'],
    ['forecast operating profit', 'profit_forecast'],
    ['how close are we to break even', 'break_even_progress'],
    ['break down expenses by category', 'expense_breakdown'],
    ['show our largest expenses', 'largest_expenses'],
    ['which costs changed significantly', 'expense_change_detector'],
    ['how much budget remains', 'budget_remaining'],
    ['will we finish over budget', 'budget_forecast'],
    ['forecast cash inflows', 'cash_inflow_forecast'],
    ['forecast cash outflows', 'cash_outflow_forecast'],
  ])('maps %s to %s', (message, type) => {
    expect(selectStage3FallbackSpecs(message)).toContainEqual({ type })
    expect(listStage3WidgetCandidates(message).map((candidate) => candidate.type)).toContain(type)
  })
})
