import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  listConversationMessages,
  mapConversationMessagesToPayload,
} from '@/lib/chat/persistence'

interface RouteContext {
  params: Promise<{
    conversationId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { conversationId } = await context.params
    const messages = await listConversationMessages(conversationId, user.id)

    return successResponse({
      conversationId,
      conversation: mapConversationMessagesToPayload(messages),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
