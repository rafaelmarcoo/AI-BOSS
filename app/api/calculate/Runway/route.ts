import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { readJsonBody } from '@/lib/api/validation'
import { requireAuthenticatedUser } from '@/lib/auth'
import { RunwayInputSchema, calculateRunway } from '@/lib/calculations/runway'

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request)

    const body = await readJsonBody(request)

    // Validate with the shared Zod schema — converts field-level ZodErrors
    // into the project's standard ApiError shape so handleRouteError can
    // format them consistently with the rest of the API
    const parsed = RunwayInputSchema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Invalid runway inputs.',
        parsed.error.flatten().fieldErrors
      )
    }

    const result = calculateRunway(parsed.data)

    return successResponse(result)
  } catch (error) {
    return handleRouteError(error)
  }
}