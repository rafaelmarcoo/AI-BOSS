import { routeFinancialQuestion } from '@/lib/agents/router'

describe('routeFinancialQuestion', () => {
  it.each([
    ['What is my current cash?', 'financial_position'],
    ['What is my runway?', 'financial_position'],
    ['How has cash changed over the last 3 months?', 'historical_forecast'],
    ['Forecast the next 6 months of runway.', 'historical_forecast'],
    ['What if I hire someone for 5000 per month?', 'scenario'],
    ['Cut our burn by 20%.', 'scenario'],
    ['How are we doing?', 'financial_position'],
  ] as const)('routes %s to %s', (query, expected) => {
    expect(routeFinancialQuestion(query)).toBe(expected)
  })
})
