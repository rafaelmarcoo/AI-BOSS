import {
  getScenarioPreflightClarification,
  routeFinancialConversation,
  routeFinancialQuestion,
} from '@/lib/agents/router'

describe('routeFinancialQuestion', () => {
  it.each([
    ['What is my current cash?', 'financial_position'],
    ['What is my runway?', 'financial_position'],
    ['How has cash changed over the last 3 months?', 'historical_forecast'],
    ['Forecast the next 6 months of runway.', 'historical_forecast'],
    ['What if I hire someone for 5000 per month?', 'scenario'],
    ['Nothing, just firing someone earning NZD 80,000 annually.', 'scenario'],
    ['Cut our burn by 20%.', 'scenario'],
    ['How are we doing?', 'financial_position'],
  ] as const)('routes %s to %s', (query, expected) => {
    expect(routeFinancialQuestion(query)).toBe(expected)
  })

  it('requires confirmed monthly staffing cost instead of converting annual salary', () => {
    expect(getScenarioPreflightClarification('What if I hire someone on a NZD 80,000 annual salary?')).toContain('total monthly employer cost')
    expect(getScenarioPreflightClarification('Hire someone for a total monthly employer cost of NZD 8,000')).toBeNull()
    expect(getScenarioPreflightClarification('Nothing, just firing someone earning NZD 80,000 annually.')).toContain('monthly saving')
  })

  it('keeps short confirmations with the scenario specialist', () => {
    expect(routeFinancialConversation(
      '1. NZD 2. yes 3. recurring 4. six months',
      [{ role: 'assistant', content: 'Which source/currency should I use for this scenario?' }]
    )).toBe('scenario')
  })
})
