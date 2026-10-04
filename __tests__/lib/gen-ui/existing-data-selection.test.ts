import {
  listExistingDataWidgetCandidates,
  selectExistingDataFallbackSpecs,
} from '@/lib/gen-ui/existing-data-selection'

const availableMetricKeys = [
  'cash',
  'monthly_revenue',
  'monthly_expenses',
  'accounts_receivable',
  'accounts_payable',
] as const

describe('existing-data widget selection', () => {
  it.each([
    ['What is our current cash balance?', 'cash_balance'],
    ['Show current revenue', 'revenue_snapshot'],
    ['How has revenue trended over time?', 'revenue_trend'],
    ['What is month-on-month revenue growth?', 'revenue_growth'],
    ['Show total expenses', 'expense_summary'],
    ['How have expenses changed?', 'expense_trend'],
    ['How much do customers owe us?', 'accounts_receivable'],
    ['How much do we owe suppliers?', 'accounts_payable'],
    ['Give me a financial health overview', 'ai_financial_brief'],
  ])('maps %s to %s', (userMessage, expectedType) => {
    const candidates = listExistingDataWidgetCandidates({
      userMessage,
      availableMetricKeys,
      historicalMetricKey: /expense/i.test(userMessage)
        ? 'monthly_expenses'
        : /revenue/i.test(userMessage)
          ? 'monthly_revenue'
          : null,
      hasHistoricalSeries: true,
    })

    expect(candidates.map((item) => item.type)).toContain(expectedType)
    expect(selectExistingDataFallbackSpecs(userMessage).map((item) => item.type)).toContain(expectedType)
  })

  it('does not compete with future forecast widgets', () => {
    expect(selectExistingDataFallbackSpecs('Forecast revenue for the next 6 months')).toEqual([])
    expect(selectExistingDataFallbackSpecs('Forecast expenses for the next 3 months')).toEqual([])
  })

  it('does not offer a financial brief without any structured metrics', () => {
    expect(listExistingDataWidgetCandidates({
      userMessage: 'Give me a financial overview',
      availableMetricKeys: [],
      historicalMetricKey: null,
      hasHistoricalSeries: false,
    })).toEqual([])
  })
})
