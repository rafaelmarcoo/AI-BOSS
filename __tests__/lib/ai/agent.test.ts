import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { buildAgentMessages } from '@/lib/ai/agent'

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
