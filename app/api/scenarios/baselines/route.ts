import { handleRouteError, successResponse } from '@/lib/api/responses'
import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listScenarioBaselineOptions } from '@/lib/scenarios/service'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const baselines = await listScenarioBaselineOptions(user.id)
    return successResponse({ baselines })
  } catch (error) {
    return handleRouteError(error)
  }
}
