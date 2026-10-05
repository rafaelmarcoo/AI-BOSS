import { routeFinancialConversation } from '@/lib/agents/router'
import { scenarioQuestionFor } from '@/lib/agents/scenario-question'

const twoSources = {
  field: 'source_currency',
  message: 'More than one source or currency is available. Ask the user to choose exactly one before calculating.',
  options: [
    { sourceKey: 'document:1', sourceLabel: 'ai-boss-demo-full-statements.csv', currency: 'NZD' },
    { sourceKey: 'document:2', sourceLabel: 'financial-data.csv', currency: 'NZD' },
  ],
}

describe('scenarioQuestionFor', () => {
  it('lists the data sources as a real question instead of the tool note', () => {
    const question = scenarioQuestionFor(twoSources)

    expect(question).toBe(
      [
        'Which data should I use for this scenario?',
        '',
        '1. ai-boss-demo-full-statements.csv (NZD)',
        '2. financial-data.csv (NZD)',
        '',
        'Reply with the number or the file name.',
      ].join('\n')
    )
    expect(question).not.toContain('Ask the user')
  })

  it('explains when there is no usable statement at all', () => {
    const question = scenarioQuestionFor({ field: 'source_currency', message: 'No matching source…', options: [] })
    expect(question).toContain("couldn't find uploaded financial statements")
    expect(question).not.toContain('Ask the user')
  })

  it('keeps a message that is already a question', () => {
    expect(scenarioQuestionFor({ message: 'Which month should the reduction start?' })).toBe('Which month should the reduction start?')
  })

  it('turns a timing error into a question, as in my 6 Oct test', () => {
    const question = scenarioQuestionFor({
      field: 'baseline',
      message: 'The end month for "10% burn reduction" is outside the selected horizon.',
    })
    expect(question).toContain('outside the selected horizon')
    expect(question).toContain('keep going with no end date?')
  })

  it('never shows a technical validation message', () => {
    const question = scenarioQuestionFor({ field: 'assumptions', message: '[{"code":"too_small","path":["amount"]}]' })
    expect(question).not.toContain('too_small')
    expect(question).toContain('Can you confirm the amount or percentage')
  })

  it('asks for a missing baseline figure', () => {
    expect(scenarioQuestionFor({ field: 'baseline', message: 'Accounts payable is required.' })).toBe(
      "I couldn't run this scenario yet: Accounts payable is required. Can you give me that detail so I can calculate it?"
    )
  })

  it("keeps the reply to a timing question with the scenario agent", () => {
    const history = [
      { role: 'user' as const, content: 'What if I cut burn by 10%?' },
      {
        role: 'assistant' as const,
        content: scenarioQuestionFor({ field: 'baseline', message: 'The end month for "10% burn reduction" is outside the selected horizon.' }),
      },
    ]
    expect(routeFinancialConversation('no end date, keep going', history)).toBe('scenario')
  })

  it.each([
    'what are the options',
    '1',
    'use the ai boss demo csv, keep the reduction fixed, from 31 August 2026 with no end date, recurring monthly',
  ])('keeps the reply %p with the scenario agent', (reply) => {
    const history = [
      { role: 'user' as const, content: 'What if I cut burn by 10%?' },
      { role: 'assistant' as const, content: scenarioQuestionFor(twoSources) },
    ]
    expect(routeFinancialConversation(reply, history)).toBe('scenario')
  })
})
