import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { getAgentTools } from '@/lib/ai/tool-registry'
import { ChatMessagePayload } from '@/lib/api/validation'
import { ApiError } from '@/lib/api/errors'
import { runAgent, type AgentRunResult } from '@/lib/ai/agent'
import type { FinancialSpecialist } from '@/lib/agents/router'
import { runMultiAgent } from '@/lib/agents/specialists'
import { DEFAULT_MODEL, MODEL_CATALOG, type ModelName } from '@/lib/ai/models'
import { logChatDecision } from '@/lib/chat/log-chat-decision'
import { buildChatContext } from '@/lib/chat/build-chat-context'
import { planGenUi } from '@/lib/gen-ui/plan-gen-ui'
import {
  getOrCreateConversation,
  insertConversationMessage,
  listConversationMessages,
  mapConversationMessagesToPayload,
} from '@/lib/chat/persistence'
import type { ConversationVisibility } from '@/types/database'

export async function generateChatResponse(
  userId: string,
  messages: ChatMessagePayload[],
  conversationId?: string,
  visibility: ConversationVisibility = 'company',
  model?: ModelName
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
    latestUserMessage.content,
    visibility
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
  const chatContext = await buildChatContext({
    userId,
    query: latestUserMessage.content,
  })

  const multiAgentEnabled = process.env.MULTI_AGENT_MODE === 'true'
  let agentResponse: AgentRunResult
  let specialist: FinancialSpecialist | undefined
  let modelUsed: string = MODEL_CATALOG[DEFAULT_MODEL].model

  if (multiAgentEnabled) {
    const multiAgentResponse = await runMultiAgent(
      userId,
      latestUserMessage.content,
      chatHistory,
      chatContext.messages,
      model
    )
    agentResponse = multiAgentResponse
    specialist = multiAgentResponse.specialist
    modelUsed = MODEL_CATALOG[multiAgentResponse.modelName].model
  } else {
    const singleAgentModel = model ?? DEFAULT_MODEL
    agentResponse = await runAgent(
      latestUserMessage.content,
      chatHistory,
      getAgentTools(userId),
      chatContext.messages,
      undefined,
      singleAgentModel
    )
    modelUsed = MODEL_CATALOG[singleAgentModel].model
  }
  const uiPlan = await planGenUi({
    userId,
    userMessage: latestUserMessage.content,
    assistantMessage: agentResponse.content,
    toolsUsed: agentResponse.toolsUsed,
  })

  const savedAssistantMessage = await insertConversationMessage({
    conversationId: conversation.id,
    userId,
    role: 'assistant',
    content: agentResponse.content,
    uiPayload: uiPlan,
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
    modelUsed,
    tokensUsed: agentResponse.tokensUsed,
    toolsUsed: agentResponse.toolsUsed,
    responseTimeMs: Date.now() - startedAt,
    specialist,
  })

  return {
    conversationId: conversation.id,
    visibility: conversation.visibility,
    message: {
      role: 'assistant' as const,
      content: agentResponse.content,
      ui: uiPlan,
    },
    conversation: mapConversationMessagesToPayload(updatedConversationMessages),
    ui: uiPlan,
  }
}
