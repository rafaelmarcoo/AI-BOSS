import { HumanMessage } from '@langchain/core/messages'
import { getAgentTools } from '@/lib/ai/tool-registry'
import { ChatMessagePayload } from '@/lib/api/validation'
import { ApiError } from '@/lib/api/errors'
import {
  createAssistantHistoryMessage,
  runAgent,
  type AgentRunResult,
} from '@/lib/ai/agent'
import {
  getScenarioPreflightClarification,
  routeFinancialConversation,
  type FinancialSpecialist,
} from '@/lib/agents/router'
import { runMultiAgent } from '@/lib/agents/specialists'
import { CHAT_MODEL } from '@/lib/ai/model-config'
import { logChatDecision } from '@/lib/chat/log-chat-decision'
import { buildChatContext } from '@/lib/chat/build-chat-context'
import { planGenUi } from '@/lib/gen-ui/plan-gen-ui'
import {
  deleteConversation,
  getOrCreateConversation,
  insertConversationTurn,
  listConversationMessages,
  mapConversationMessagesToPayload,
} from '@/lib/chat/persistence'
import type { ConversationVisibility } from '@/types/database'

export async function generateChatResponse(
  userId: string,
  messages: ChatMessagePayload[],
  conversationId?: string,
  visibility: ConversationVisibility = 'company'
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

  const persistedMessages = await listConversationMessages(conversation.id, userId)
  const persistedChatHistory = mapConversationMessagesToPayload(persistedMessages)
  const chatHistory = persistedChatHistory.map((m) =>
    m.role === 'user'
      ? new HumanMessage(m.content)
      : createAssistantHistoryMessage(m.content)
  )
  let completedTurnSaved = false

  try {
    const chatContext = await buildChatContext({
      userId,
      query: latestUserMessage.content,
    })

    const multiAgentEnabled = process.env.MULTI_AGENT_MODE === 'true'
    let agentResponse: AgentRunResult
    let specialist: FinancialSpecialist | undefined
    const resolvedSpecialist = routeFinancialConversation(
      latestUserMessage.content,
      persistedChatHistory
    )
    const preflightClarification = getScenarioPreflightClarification(latestUserMessage.content)

    if (preflightClarification) {
      agentResponse = {
        content: preflightClarification,
        tokensUsed: null,
        toolsUsed: [],
        toolExecutions: [],
      }
      specialist = resolvedSpecialist
    } else if (multiAgentEnabled || resolvedSpecialist === 'scenario') {
      const multiAgentResponse = await runMultiAgent(
        userId,
        latestUserMessage.content,
        chatHistory,
        chatContext.messages
      )
      agentResponse = multiAgentResponse
      specialist = multiAgentResponse.specialist
    } else {
      agentResponse = await runAgent(
        latestUserMessage.content,
        chatHistory,
        getAgentTools(userId),
        chatContext.messages
      )
    }
    const uiPlan = await planGenUi({
      userId,
      userMessage: latestUserMessage.content,
      assistantMessage: agentResponse.content,
      toolsUsed: agentResponse.toolsUsed,
      toolExecutions: agentResponse.toolExecutions ?? [],
      scenarioMode: resolvedSpecialist === 'scenario',
      hasUnreviewedDocumentEvidence:
        chatContext.hasUnreviewedDocumentEvidence,
      unreviewedDocumentIds: chatContext.retrievedChunks
        .filter((chunk) => chunk.financialReviewStatus === 'pending')
        .map((chunk) => chunk.documentId),
    })

    const { userMessage: savedUserMessage, assistantMessage: savedAssistantMessage } =
      await insertConversationTurn({
        conversationId: conversation.id,
        userId,
        userContent: latestUserMessage.content,
        assistantContent: agentResponse.content,
        assistantUiPayload: uiPlan,
      })
    completedTurnSaved = true
    const updatedConversationMessages = [
      ...persistedMessages,
      savedUserMessage,
      savedAssistantMessage,
    ]

    await logChatDecision({
      userId,
      conversationId: conversation.id,
      assistantMessageId: savedAssistantMessage.id,
      messages: mapConversationMessagesToPayload(updatedConversationMessages),
      aiResponse: agentResponse.content,
      modelUsed: CHAT_MODEL,
      tokensUsed: agentResponse.tokensUsed,
      toolsUsed: agentResponse.toolsUsed,
      calculations: agentResponse.toolExecutions ?? [],
      responseTimeMs: Date.now() - startedAt,
      specialist,
    }).catch((error) => {
      // The completed turn is already saved atomically. Do not tell the client
      // the message failed and cause a duplicate retry solely because the
      // separate audit write had an outage. The server error remains visible.
      console.error('Chat turn saved, but decision logging failed.', error)
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
  } catch (error) {
    if (!conversationId && !completedTurnSaved) {
      await deleteConversation(conversation.id, userId).catch(() => undefined)
    }
    throw error
  }
}
