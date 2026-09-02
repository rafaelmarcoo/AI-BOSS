import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ToolInputParsingException } from '@langchain/core/tools'
import { convertMessagesToResponsesInput } from '@langchain/openai'
import {
  buildAgentMessages,
  createAssistantHistoryMessage,
  preserveFinancialCurrencyCoverage,
  readModelMessageText,
  requiresUnavailableAdjustedRunwayCorrection,
  toolInputRepairResult,
} from '@/lib/ai/agent'

describe('readModelMessageText', () => {
  it('extracts Markdown text from Responses API content blocks', () => {
    const message = new AIMessage({
      content: [
        {
          type: 'text',
          text: 'The uploaded CSV shows:\n\n- **31 Mar 2026:** NZD 100,000',
          annotations: [],
        },
      ],
    })

    expect(readModelMessageText(message)).toBe(
      'The uploaded CSV shows:\n\n- **31 Mar 2026:** NZD 100,000'
    )
  })

  it('preserves plain Chat Completions text', () => {
    expect(readModelMessageText(new AIMessage('Plain response'))).toBe(
      'Plain response'
    )
  })
})

describe('createAssistantHistoryMessage', () => {
  it('rebuilds persisted text as a Responses-compatible content block', () => {
    const message = createAssistantHistoryMessage('Earlier answer')

    expect(message.content).toEqual([
      { type: 'text', text: 'Earlier answer', annotations: [] },
    ])
    expect(message.text).toBe('Earlier answer')

    expect(() => convertMessagesToResponsesInput({
      messages: [message],
      zdrEnabled: false,
      model: 'gpt-5.6-luna',
    })).not.toThrow()
  })
})

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

describe('requiresUnavailableAdjustedRunwayCorrection', () => {
  const evidence = [
    'Working-capital-adjusted runway status: UNAVAILABLE.\nReason: Accounts receivable for 2026-05-31 was explicitly excluded.',
  ]

  it('rejects a numeric result calculated from mismatched adjusted-runway inputs', () => {
    expect(
      requiresUnavailableAdjustedRunwayCorrection({
        response:
          'Working-capital-adjusted runway:\n`(NZD 100,000 + NZD 18,000 - NZD 14,000) / NZD 17,000 = 6.12 months`',
        evidence,
      })
    ).toBe(true)
  })

  it('allows the valid cash result with only a symbolic adjusted formula', () => {
    expect(
      requiresUnavailableAdjustedRunwayCorrection({
        response:
          'Cash runway: NZD 100,000 / NZD 17,000 = 5.88 months.\n\nWorking-capital-adjusted runway is unavailable. Formula: `(cash + accounts receivable - accounts payable) / monthly burn`.',
        evidence,
      })
    ).toBe(false)
  })

  it('does not restrict an adjusted result when deterministic evidence says it is available', () => {
    expect(
      requiresUnavailableAdjustedRunwayCorrection({
        response: 'Working-capital-adjusted runway: 6.12 months.',
        evidence: ['Working-capital-adjusted runway status: AVAILABLE.'],
      })
    ).toBe(false)
  })
})

describe('toolInputRepairResult', () => {
  it('turns schema failures into a repair instruction for the model', () => {
    const result = toolInputRepairResult(
      'model_scenario',
      new ToolInputParsingException('Received tool input did not match expected schema')
    )

    expect(result).toMatchObject({
      status: 'invalid_tool_input',
      tool: 'model_scenario',
    })
    expect(result?.message).toContain('call the same tool again')
  })

  it('does not hide non-validation tool failures', () => {
    expect(toolInputRepairResult('model_scenario', new Error('Database unavailable'))).toBeNull()
  })
})
