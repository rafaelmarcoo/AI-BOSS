import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { updateDocumentCurrency } from '@/lib/documents/persistence'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const body = (await request.json()) as { currency?: unknown }

    if (body.currency !== 'NZD' && body.currency !== 'AUD') {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'currency must be NZD or AUD.'
      )
    }

    const document = await updateDocumentCurrency({
      documentId,
      requesterId: user.id,
      currency: body.currency,
    })
    return successResponse({ document })
  } catch (error) {
    return handleRouteError(error)
  }
}
