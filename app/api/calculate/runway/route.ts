import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readJsonBody } from '@/lib/api/validation'
import {
  calculateAndStoreRunwaySnapshot,
  validateRunwayInput,
} from '@/lib/services/runway-service'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const input = validateRunwayInput(await readJsonBody(request))
    const { result, snapshotStored } = await calculateAndStoreRunwaySnapshot(
      user.id,
      input
    )

    return successResponse({
      ...result,
      snapshotStored,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
