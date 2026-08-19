import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  deleteSavedScenario,
  getSavedScenario,
  updateSavedScenario,
} from '@/lib/scenarios/persistence'

interface RouteContext {
  params: Promise<{ scenarioId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { scenarioId } = await context.params
    return successResponse({ scenario: await getSavedScenario(scenarioId, user.id) })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { scenarioId } = await context.params
    return successResponse({ scenario: await updateSavedScenario(scenarioId, user.id, await request.json()) })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { scenarioId } = await context.params
    await deleteSavedScenario(scenarioId, user.id)
    return successResponse({ deleted: true, scenarioId })
  } catch (error) {
    return handleRouteError(error)
  }
}

