import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readJsonBody } from '@/lib/api/validation'
import {
  calculateRunwayResult,
  validateRunwayInput,
} from '@/lib/services/runway-service'

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request)
    const input = validateRunwayInput(await readJsonBody(request))
    const result = calculateRunwayResult(input)

    return successResponse(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
