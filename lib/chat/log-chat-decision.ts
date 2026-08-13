import { ApiError } from '@/lib/api/errors'
import { ChatMessagePayload } from '@/lib/api/validation'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { AgentToolUsage } from '@/lib/ai/agent'
import type { FinancialSpecialist } from '@/lib/agents/router'

interface LogChatDecisionParams {
  userId: string
  conversationId: string
  assistantMessageId: string
  messages: ChatMessagePayload[]
  aiResponse: string
  modelUsed: string
  tokensUsed: number | null
  toolsUsed: AgentToolUsage[]
  responseTimeMs: number
  specialist?: FinancialSpecialist
}

export async function logChatDecision({
  userId,
  conversationId,
  assistantMessageId,
  messages,
  aiResponse,
  modelUsed,
  tokensUsed,
  toolsUsed,
  responseTimeMs,
  specialist,
}: LogChatDecisionParams) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')

  if (!lastUserMessage) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'A chat request must include at least one user message.'
    )
  }

  const supabase = createAdminSupabaseClient()

  // Store the latest user prompt in the main text column and preserve the
  // full conversation in its own JSONB column so future chat features do not
  // have to overload unrelated audit fields.
  const { error } = await supabase.from('decision_log').insert({
    user_id: userId,
    conversation_id: conversationId,
    assistant_message_id: assistantMessageId,
    event_type: 'chat_completion',
    user_query: lastUserMessage.content,
    ai_response: aiResponse,
    conversation_history: messages,
    tools_used: specialist
      ? [...toolsUsed, { tool: 'specialist_router', args: { specialist } }]
      : toolsUsed,
    data_accessed: null,
    calculations: null,
    model_used: modelUsed,
    tokens_used: tokensUsed,
    response_time_ms: responseTimeMs,
  })

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to log chat decision.')
  }
}
