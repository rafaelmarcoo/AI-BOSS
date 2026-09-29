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

describe('company analysis routing', () => {
  it.each([
    'Analyse Trimayr',
    'Compare Ressett with its competitor',
    "How is Fixxupp's revenue growing?",
    'Tell me about Pallo and Troo',
    'Which case study company is more profitable?',
    'How do we compare with our competitors?',
  ])('routes %p to the company analyst', (query) => {
    expect(routeFinancialQuestion(query)).toBe('company_analysis')
  })

  it.each([
    ['What do my ratios say?', 'financial_position'],
    ['What do my ratios say by CIMA standards?', 'financial_position'],
    ['What is my runway?', 'financial_position'],
    ['Compare hiring for NZD 8,000 per month with buying equipment.', 'scenario'],
  ] as const)('keeps own-business question %p with %s', (query, expected) => {
    expect(routeFinancialQuestion(query)).toBe(expected)
  })

  const afterComparison = [
    { role: 'user' as const, content: 'Compare Ressett with Fixxupp' },
    { role: 'assistant' as const, content: 'Ressett is more profitable than Fixxupp, but Fixxupp is growing faster.' },
  ]

  it.each(['Which one is growing faster?', 'What about gearing?', 'Why?'])(
    'keeps follow-up %p with the company analyst',
    (query) => {
      // "growing" alone would otherwise send this to the scenario specialist.
      expect(routeFinancialConversation(query, afterComparison)).toBe('company_analysis')
    }
  )

  it.each([
    ['What is my runway?', 'financial_position'],
    ['What if I cut burn by 10%?', 'scenario'],
  ] as const)('lets %p return to the user’s own business', (query, expected) => {
    expect(routeFinancialConversation(query, afterComparison)).toBe(expected)
  })
})

describe('scenario clarification replies', () => {
  it('keeps a timing answer with the scenario specialist', () => {
    expect(
      routeFinancialConversation('Start October 2026, no end date.', [
        { role: 'user', content: 'What if I cut monthly burn by NZD 3,000 from next month?' },
        {
          role: 'assistant',
          content: 'What start and end timing should I use for the recurring NZD 3,000 monthly burn reduction?',
        },
      ])
    ).toBe('scenario')
  })
})

describe('forecast words inside a scenario answer', () => {
  const askedForTiming = [
    { role: 'user' as const, content: 'What if I cut monthly burn by NZD 3,000 from next month?' },
    {
      role: 'assistant' as const,
      content: 'What start and end timing should I use for the recurring NZD 3,000 monthly burn reduction?',
    },
  ]

  it.each([
    'Start October 2026, no end date. Apply it for the whole projection.',
    'Use a 6 month horizon.',
    'From next month, for the future.',
  ])('keeps %p with the scenario specialist', (reply) => {
    expect(routeFinancialConversation(reply, askedForTiming)).toBe('scenario')
  })

  it('still lets a plainly new forecast request through', () => {
    expect(
      routeFinancialConversation('Actually, can you forecast my cash for the next 3 months instead?', askedForTiming)
    ).toBe('historical_forecast')
  })
})
