import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { updateDocumentCurrency } from '@/lib/documents/persistence'
import { updateFinancialMetricObservationsCurrencyForDocument } from '@/lib/financial-data/persistence'

const SUPPORTED_CURRENCIES = ['USD', 'NZD']

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const body = (await request.json()) as { currency?: unknown }

    if (typeof body.currency !== 'string' || !SUPPORTED_CURRENCIES.includes(body.currency)) {
      throw new ApiError(400, 'BAD_REQUEST', 'currency must be one of USD, NZD.')
    }

    const document = await updateDocumentCurrency({
      documentId,
      userId: user.id,
      currency: body.currency,
    })

    await updateFinancialMetricObservationsCurrencyForDocument({
      documentId,
      userId: user.id,
      currency: body.currency,
    })

    return successResponse({ document })
  } catch (error) {
    return handleRouteError(error)
  }
}
