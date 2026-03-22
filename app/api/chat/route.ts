import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)

    return successResponse({
      service: 'chat',
      status: 'not_implemented',
      user,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
