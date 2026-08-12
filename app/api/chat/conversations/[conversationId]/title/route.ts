import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { generateAiConversationTitle } from '@/lib/chat/ai-conversation-title'
import { createConversationTitle } from '@/lib/chat/conversation-title'
import {
  getCompanyConversation,
  listConversationMessages,
  renameConversation,
} from '@/lib/chat/persistence'

interface RouteContext {
  params: Promise<{ conversationId: string }>
}

/**
 * Generates a title after the first response. It deliberately refuses to run
 * after a manual rename or once the conversation has progressed beyond one turn.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { conversationId } = await context.params
    const conversation = await getCompanyConversation(conversationId, user.id)

    if (conversation.user_id !== user.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Only the conversation owner can title it.')
    }

    const messages = await listConversationMessages(conversationId, user.id)
    const [firstUserMessage, firstAssistantMessage] = messages
    const fallbackTitle = firstUserMessage?.content
      ? createConversationTitle(firstUserMessage.content)
      : null

    if (
      messages.length !== 2 ||
      firstUserMessage?.role !== 'user' ||
      firstAssistantMessage?.role !== 'assistant' ||
      conversation.title !== fallbackTitle
    ) {
      return successResponse({ conversation, generated: false })
    }

    const title = await generateAiConversationTitle({
      firstUserMessage: firstUserMessage.content,
      firstAssistantMessage: firstAssistantMessage.content,
    })

    if (!title) {
      return successResponse({ conversation, generated: false })
    }

    const updatedConversation = await renameConversation(conversationId, user.id, title)

    return successResponse({ conversation: updatedConversation, generated: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
