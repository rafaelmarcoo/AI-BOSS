import { ChatMessagePayload } from '@/lib/api/validation'
import { ApiError } from '@/lib/api/errors'
import { createOpenAIChatCompletion } from '@/lib/openai/chat'
import { logChatDecision } from '@/lib/chat/log-chat-decision'
import {
  getOrCreateConversation,
  insertConversationMessage,
  listConversationMessages,
  mapConversationMessagesToPayload,
} from '@/lib/chat/persistence'

export async function generateChatResponse(
  userId: string,
  messages: ChatMessagePayload[],
  conversationId?: string
) {
  const startedAt = Date.now()
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')

  if (!latestUserMessage) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'A chat request must include at least one user message.'
    )
  }

  const conversation = await getOrCreateConversation(
    userId,
    conversationId,
    latestUserMessage.content
  )

  await insertConversationMessage({
    conversationId: conversation.id,
    userId,
    role: 'user',
    content: latestUserMessage.content,
  })

  const persistedMessages = await listConversationMessages(conversation.id, userId)
  const completion = await createOpenAIChatCompletion(
    mapConversationMessagesToPayload(persistedMessages)
  )
  const assistantMessage = {
    role: 'assistant' as const,
    content: completion.content,
  }
  const savedAssistantMessage = await insertConversationMessage({
    conversationId: conversation.id,
    userId,
    role: assistantMessage.role,
    content: assistantMessage.content,
  })
  const updatedConversationMessages = await listConversationMessages(
    conversation.id,
    userId
  )

  await logChatDecision({
    userId,
    conversationId: conversation.id,
    assistantMessageId: savedAssistantMessage.id,
    messages: mapConversationMessagesToPayload(updatedConversationMessages),
    aiResponse: assistantMessage.content,
    modelUsed: completion.model,
    tokensUsed: completion.tokensUsed,
    responseTimeMs: Date.now() - startedAt,
  })

  return {
    conversationId: conversation.id,
    message: assistantMessage,
    conversation: mapConversationMessagesToPayload(updatedConversationMessages),
  }
}
