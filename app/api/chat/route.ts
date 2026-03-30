import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  assertValid,
  readJsonBody,
  validateChatPayload,
} from '@/lib/api/validation'
import { generateChatResponse } from '@/lib/chat/generate-chat-response'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const payload = assertValid(validateChatPayload(await readJsonBody(request)))
    const chatResponse = await generateChatResponse(user.id, payload.messages)

    return successResponse({
      ...chatResponse,
      user,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
