import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listUserConversations } from '@/lib/chat/persistence'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const conversations = await listUserConversations(user.id)

    return successResponse({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        visibility: conversation.visibility,
        isOwner: conversation.user_id === user.id,
      })),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
