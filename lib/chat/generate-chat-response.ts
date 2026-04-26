import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { ChatMessagePayload } from '@/lib/api/validation'
import { ApiError } from '@/lib/api/errors'
import { runAgent } from '@/lib/ai/agent'
import { CHAT_MODEL } from '@/lib/chat/system-prompt'
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
  const chatHistory = mapConversationMessagesToPayload(persistedMessages.slice(0, -1))
    .map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    )

  // Run the agent - tools will be registered here in Card 11
  const agentResponse = await runAgent(latestUserMessage.content, chatHistory)

  const savedAssistantMessage = await insertConversationMessage({
    conversationId: conversation.id,
    userId,
    role: 'assistant',
    content: agentResponse.content,
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
    aiResponse: agentResponse.content,
    modelUsed: CHAT_MODEL,
    tokensUsed: agentResponse.tokensUsed,
    responseTimeMs: Date.now() - startedAt,
  })

  return {
    conversationId: conversation.id,
    message: { role: 'assistant' as const, content: agentResponse.content },
    conversation: mapConversationMessagesToPayload(updatedConversationMessages),
  }
}
