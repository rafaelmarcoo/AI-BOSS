import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listRecentActivity } from '@/lib/activity/recent-activity'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    return successResponse({ activities: await listRecentActivity(user.id) })
  } catch (error) {
    return handleRouteError(error)
  }
}
