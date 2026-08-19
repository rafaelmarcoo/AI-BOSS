import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { duplicateSavedScenario } from '@/lib/scenarios/persistence'

interface RouteContext {
  params: Promise<{ scenarioId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { scenarioId } = await context.params
    return successResponse({ scenario: await duplicateSavedScenario(scenarioId, user.id) }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

