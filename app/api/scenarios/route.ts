import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createSavedScenario, listSavedScenarios } from '@/lib/scenarios/persistence'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    return successResponse({ scenarios: await listSavedScenarios(user.id) })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    return successResponse({ scenario: await createSavedScenario(user.id, await request.json()) }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

