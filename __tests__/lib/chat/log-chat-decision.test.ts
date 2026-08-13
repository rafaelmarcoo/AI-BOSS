import { logChatDecision } from '@/lib/chat/log-chat-decision'
import { createAdminSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockCreateAdminSupabaseClient = jest.mocked(createAdminSupabaseClient)

describe('logChatDecision', () => {
  it('records the selected specialist alongside real tool calls without a schema change', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({ insert })),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await logChatDecision({
      userId: 'user-123',
      conversationId: 'conversation-123',
      assistantMessageId: 'assistant-123',
      messages: [{ role: 'user', content: 'Forecast cash for 3 months' }],
      aiResponse: 'Forecast result',
      modelUsed: 'gpt-4o-mini',
      tokensUsed: 12,
      toolsUsed: [{ tool: 'get_financial_forecast', args: { metricKey: 'cash' } }],
      responseTimeMs: 100,
      specialist: 'historical_forecast',
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      tools_used: [
        { tool: 'get_financial_forecast', args: { metricKey: 'cash' } },
        { tool: 'specialist_router', args: { specialist: 'historical_forecast' } },
      ],
    }))
  })
})
