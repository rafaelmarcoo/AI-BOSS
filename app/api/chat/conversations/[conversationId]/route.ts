import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  deleteConversation,
  getCompanyConversation,
  listConversationMessages,
  mapConversationMessagesToPayload,
  renameConversation,
  updateConversationVisibility,
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
      visibility: conversation.visibility,
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
    const body = (await request.json()) as {
      title?: unknown
      visibility?: unknown
    }

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

    if (
      body.visibility !== undefined &&
      body.visibility !== 'private' &&
      body.visibility !== 'company' &&
      body.visibility !== 'admins'
    ) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'visibility must be private, company, or admins.'
      )
    }

    if (body.title === undefined && body.visibility === undefined) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'Provide a title or visibility to update.'
      )
    }

    let conversation

    if (body.title !== undefined) {
      const normalizedTitle =
        typeof body.title === 'string' ? body.title.trim() || null : null
      conversation = await renameConversation(
        conversationId,
        user.id,
        normalizedTitle
      )
    }

    if (
      body.visibility === 'private' ||
      body.visibility === 'company' ||
      body.visibility === 'admins'
    ) {
      conversation = await updateConversationVisibility(
        conversationId,
        user.id,
        body.visibility
      )
    }

    if (!conversation) {
      throw new ApiError(400, 'BAD_REQUEST', 'No conversation update was provided.')
    }

    return successResponse({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        visibility: conversation.visibility,
        isOwner: true,
      },
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
