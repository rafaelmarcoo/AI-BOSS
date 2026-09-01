import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import {
  buildAgentMessages,
  mergeSystemMessages,
  preserveFinancialCurrencyCoverage,
} from '@/lib/ai/agent'

describe('buildAgentMessages', () => {
  it('places supplied context after the system prompt and before chat history', () => {
    const messages = buildAgentMessages({
      input: 'What is my runway?',
      contextMessages: [new SystemMessage('structured metrics context')],
      chatHistory: [
        new HumanMessage('Earlier question'),
        new AIMessage('Earlier answer'),
      ],
    })

    expect(messages.map((message) => message._getType())).toEqual([
      'system',
      'system',
      'human',
      'ai',
      'human',
    ])
    expect(messages[1].content).toBe('structured metrics context')
    expect(messages[4].content).toBe('What is my runway?')
  })
})

describe('mergeSystemMessages', () => {
  it('folds every system message into one leading message, keeping order', () => {
    const merged = mergeSystemMessages(
      buildAgentMessages({
        input: 'What is my runway?',
        systemPrompt: 'base prompt',
        contextMessages: [
          new SystemMessage('metrics context'),
          new SystemMessage('document context'),
        ],
        chatHistory: [new HumanMessage('Earlier'), new AIMessage('Answer')],
      })
    )

    expect(merged.map((message) => message._getType())).toEqual([
      'system',
      'human',
      'ai',
      'human',
    ])
    expect(merged[0].content).toBe(
      'base prompt\n\nmetrics context\n\ndocument context'
    )
  })

  it('leaves a conversation without system messages untouched', () => {
    const conversation = [new HumanMessage('Hello')]

    expect(mergeSystemMessages(conversation)).toEqual(conversation)
  })
})

describe('preserveFinancialCurrencyCoverage', () => {
  const toolResult = `Cash history — NZD (all): 3 observations.\nLatest value: NZD 80,000.\n\nCash history — AUD (all): 3 observations.\nLatest value: AUD 75,000.`

  it('appends a returned currency series omitted by the model', () => {
    const response = preserveFinancialCurrencyCoverage(
      'Your latest cash value is NZD 80,000.',
      [{ name: 'get_financial_history', content: toolResult }]
    )

    expect(response).toContain('Your latest cash value is NZD 80,000.')
    expect(response).toContain('Cash history — AUD')
    expect(response).toContain('AUD 75,000')
  })

  it('does not duplicate currencies already covered by the model', () => {
    const original = 'NZD is 80,000 and AUD is 75,000.'

    expect(preserveFinancialCurrencyCoverage(
      original,
      [{ name: 'get_financial_forecast', content: toolResult }]
    )).toBe(original)
  })
})
