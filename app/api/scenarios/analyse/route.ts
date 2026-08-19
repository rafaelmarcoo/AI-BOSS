import { ZodError } from 'zod'
import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readJsonBody } from '@/lib/api/validation'
import { analyseScenario } from '@/lib/scenarios/service'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const result = await analyseScenario(user.id, await readJsonBody(request))
    return successResponse({ result })
  } catch (error) {
    if (error instanceof ZodError) {
      return handleRouteError(
        new ApiError(400, 'BAD_REQUEST', 'The scenario assumptions are invalid.', error.flatten())
      )
    }
    if (error instanceof Error && !(error instanceof ApiError)) {
      return handleRouteError(new ApiError(400, 'BAD_REQUEST', error.message))
    }
    return handleRouteError(error)
  }
}
