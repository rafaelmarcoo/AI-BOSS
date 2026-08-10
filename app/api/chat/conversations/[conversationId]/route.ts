import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  deleteConversation,
  getCompanyConversation,
  listConversationMessages,
  mapConversationMessagesToPayload,
  renameConversation,
} from '@/lib/chat/persistence'
import { ApiError } from '@/lib/api/errors'

interface RouteContext {
  params: Promise<{
    conversationId: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { conversationId } = await context.params
    const conversation = await getCompanyConversation(conversationId, user.id)
    const messages = await listConversationMessages(conversationId, user.id)

    return successResponse({
      conversationId,
      conversation: mapConversationMessagesToPayload(messages),
      isOwner: conversation.user_id === user.id,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { conversationId } = await context.params
    const body = (await request.json()) as { title?: unknown }

    if (
      body.title !== undefined &&
      body.title !== null &&
      typeof body.title !== 'string'
    ) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'title must be a string or null.'
      )
    }

    const normalizedTitle =
      typeof body.title === 'string' ? body.title.trim() || null : null

    const conversation = await renameConversation(
      conversationId,
      user.id,
      normalizedTitle
    )

    return successResponse({
      conversation,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { conversationId } = await context.params

    await deleteConversation(conversationId, user.id)

    return successResponse({
      deleted: true,
      conversationId,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
