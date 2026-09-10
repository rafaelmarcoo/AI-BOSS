import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { updateFinancialMetricObservationValue } from '@/lib/financial-data/persistence'

interface RouteContext {
  params: Promise<{ observationId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { observationId } = await context.params
    const body = (await request.json()) as { value?: unknown }

    if (typeof body.value !== 'number' || !Number.isFinite(body.value)) {
      throw new ApiError(400, 'BAD_REQUEST', 'value must be a finite number.')
    }

    const observation = await updateFinancialMetricObservationValue({
      userId: user.id,
      observationId,
      value: body.value,
    })

    return successResponse({ observation })
  } catch (error) {
    return handleRouteError(error)
  }
}
