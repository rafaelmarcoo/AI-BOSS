import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listUserConversations } from '@/lib/chat/persistence'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const conversations = await listUserConversations(user.id)

    return successResponse({
      conversations,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
