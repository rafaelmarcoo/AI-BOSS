import { SystemMessage } from '@langchain/core/messages'
import { generateChatResponse } from '@/lib/chat/generate-chat-response'
import { buildChatContext } from '@/lib/chat/build-chat-context'
import { runAgent } from '@/lib/ai/agent'
import { runMultiAgent } from '@/lib/agents/specialists'
import { getAgentTools } from '@/lib/ai/tool-registry'
import {
  getOrCreateConversation,
  insertConversationMessage,
  listConversationMessages,
} from '@/lib/chat/persistence'
import { logChatDecision } from '@/lib/chat/log-chat-decision'
import { planGenUi } from '@/lib/gen-ui/plan-gen-ui'

jest.mock('@/lib/chat/build-chat-context', () => ({
  buildChatContext: jest.fn(),
}))

jest.mock('@/lib/ai/agent', () => ({
  runAgent: jest.fn(),
}))

jest.mock('@/lib/agents/specialists', () => ({
  runMultiAgent: jest.fn(),
}))

jest.mock('@/lib/ai/tool-registry', () => ({
  getAgentTools: jest.fn(() => [{ name: 'calculate_runway' }]),
}))

jest.mock('@/lib/chat/persistence', () => ({
  getOrCreateConversation: jest.fn(),
  insertConversationMessage: jest.fn(),
  listConversationMessages: jest.fn(),
  mapConversationMessagesToPayload: jest.fn((messages) =>
    messages.map((message: { role: string; content: string }) => ({
      role: message.role,
      content: message.content,
    }))
  ),
}))

jest.mock('@/lib/chat/log-chat-decision', () => ({
  logChatDecision: jest.fn(),
}))

jest.mock('@/lib/gen-ui/plan-gen-ui', () => ({
  planGenUi: jest.fn(),
}))

const mockBuildChatContext = jest.mocked(buildChatContext)
const mockRunAgent = jest.mocked(runAgent)
const mockRunMultiAgent = jest.mocked(runMultiAgent)
const mockGetAgentTools = jest.mocked(getAgentTools)
const mockGetOrCreateConversation = jest.mocked(getOrCreateConversation)
const mockInsertConversationMessage = jest.mocked(insertConversationMessage)
const mockListConversationMessages = jest.mocked(listConversationMessages)
const mockLogChatDecision = jest.mocked(logChatDecision)
const mockPlanGenUi = jest.mocked(planGenUi)

describe('generateChatResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.MULTI_AGENT_MODE
  })

  it('passes built financial and document context into the agent', async () => {
    const contextMessages = [new SystemMessage('metrics and RAG context')]

    mockGetOrCreateConversation.mockResolvedValue({
      id: 'conversation-1',
      user_id: 'user-123',
      company_id: 'company-1',
      visibility: 'company',
      title: 'What is my runway?',
      created_at: '2026-05-12T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockInsertConversationMessage
      .mockResolvedValueOnce({
        id: 'message-user',
        conversation_id: 'conversation-1',
        user_id: 'user-123',
        role: 'user',
        content: 'What is my runway?',
        citations: null,
        ui_payload: null,
        created_at: '2026-05-12T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'message-assistant',
        conversation_id: 'conversation-1',
        user_id: 'user-123',
        role: 'assistant',
        content: 'Your runway is 5.4 months.',
        citations: null,
        ui_payload: null,
        created_at: '2026-05-12T00:00:00.000Z',
      })
    mockListConversationMessages
      .mockResolvedValueOnce([
        {
          id: 'message-user',
          conversation_id: 'conversation-1',
          user_id: 'user-123',
          role: 'user',
          content: 'What is my runway?',
          citations: null,
          ui_payload: null,
          created_at: '2026-05-12T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'message-user',
          conversation_id: 'conversation-1',
          user_id: 'user-123',
          role: 'user',
          content: 'What is my runway?',
          citations: null,
          ui_payload: null,
          created_at: '2026-05-12T00:00:00.000Z',
        },
        {
          id: 'message-assistant',
          conversation_id: 'conversation-1',
          user_id: 'user-123',
          role: 'assistant',
          content: 'Your runway is 5.4 months.',
          citations: null,
          ui_payload: null,
          created_at: '2026-05-12T00:00:00.000Z',
        },
      ])
    mockBuildChatContext.mockResolvedValue({
      messages: contextMessages,
      metricKeys: ['cash'],
      retrievedChunks: [],
    })
    mockRunAgent.mockResolvedValue({
      content: 'Your runway is 5.4 months.',
      tokensUsed: 123,
      toolsUsed: [],
    })
    mockPlanGenUi.mockResolvedValue(null)

    await generateChatResponse(
      'user-123',
      [{ role: 'user', content: 'What is my runway?' }],
      'conversation-1'
    )

    expect(mockBuildChatContext).toHaveBeenCalledWith({
      userId: 'user-123',
      query: 'What is my runway?',
    })
    expect(mockGetAgentTools).toHaveBeenCalledWith('user-123')
    expect(mockRunAgent).toHaveBeenCalledWith(
      'What is my runway?',
      [],
      [{ name: 'calculate_runway' }],
      contextMessages
    )
    expect(mockLogChatDecision).toHaveBeenCalled()
  })

  it('uses the selected specialist only when server-side multi-agent mode is enabled', async () => {
    process.env.MULTI_AGENT_MODE = 'true'
    const contextMessages = [new SystemMessage('metrics and RAG context')]

    mockGetOrCreateConversation.mockResolvedValue({
      id: 'conversation-1', user_id: 'user-123', company_id: 'company-1', visibility: 'company',
      title: 'Forecast cash', created_at: '2026-05-12T00:00:00.000Z', updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockInsertConversationMessage
      .mockResolvedValueOnce({
        id: 'message-user', conversation_id: 'conversation-1', user_id: 'user-123', role: 'user', content: 'Forecast cash', citations: null, ui_payload: null, created_at: '2026-05-12T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'message-assistant', conversation_id: 'conversation-1', user_id: 'user-123', role: 'assistant', content: 'Forecast result', citations: null, ui_payload: null, created_at: '2026-05-12T00:00:00.000Z',
      })
    mockListConversationMessages
      .mockResolvedValueOnce([{ id: 'message-user', conversation_id: 'conversation-1', user_id: 'user-123', role: 'user', content: 'Forecast cash', citations: null, ui_payload: null, created_at: '2026-05-12T00:00:00.000Z' }])
      .mockResolvedValueOnce([])
    mockBuildChatContext.mockResolvedValue({ messages: contextMessages, metricKeys: ['cash'], retrievedChunks: [] })
    mockRunMultiAgent.mockResolvedValue({ content: 'Forecast result', tokensUsed: 88, toolsUsed: [], specialist: 'historical_forecast' })
    mockPlanGenUi.mockResolvedValue(null)

    await generateChatResponse('user-123', [{ role: 'user', content: 'Forecast cash' }], 'conversation-1')

    expect(mockRunMultiAgent).toHaveBeenCalledWith('user-123', 'Forecast cash', [], contextMessages)
    expect(mockRunAgent).not.toHaveBeenCalled()
    expect(mockLogChatDecision).toHaveBeenCalledWith(expect.objectContaining({ specialist: 'historical_forecast' }))
  })
})
