import { ChatMessagePayload } from '@/lib/api/validation'
import { createOpenAIChatCompletion } from '@/lib/openai/chat'
import { logChatDecision } from '@/lib/chat/log-chat-decision'

export async function generateChatResponse(
  userId: string,
  messages: ChatMessagePayload[]
) {
  const startedAt = Date.now()
  const completion = await createOpenAIChatCompletion(messages)
  const assistantMessage = {
    role: 'assistant' as const,
    content: completion.content,
  }

  await logChatDecision({
    userId,
    messages: [...messages, assistantMessage],
    aiResponse: assistantMessage.content,
    modelUsed: completion.model,
    tokensUsed: completion.tokensUsed,
    responseTimeMs: Date.now() - startedAt,
  })

  return {
    message: assistantMessage,
    conversation: [...messages, assistantMessage],
  }
}
