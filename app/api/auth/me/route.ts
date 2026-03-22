import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { getCurrentUserProfile, requireAuthenticatedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { accessToken } = await requireAuthenticatedUser(request)
    const data = await getCurrentUserProfile(accessToken)

    return successResponse(data)
  } catch (error) {
    return handleRouteError(error)
  }
}
