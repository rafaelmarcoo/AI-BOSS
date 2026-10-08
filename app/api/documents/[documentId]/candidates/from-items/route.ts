import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { assertValid, readJsonBody } from '@/lib/api/validation'
import { validatePromoteDocumentItemsPayload } from '@/lib/documents/review-validation'
import { promoteDocumentItemsToCandidate } from '@/lib/documents/extraction-review-persistence'
import type { PromoteDocumentItemsResponse } from '@/lib/documents/types'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const payload = assertValid(
      validatePromoteDocumentItemsPayload(await readJsonBody(request))
    )
    const candidate = await promoteDocumentItemsToCandidate({
      documentId,
      requesterId: user.id,
      ...payload,
    })

    return successResponse<PromoteDocumentItemsResponse>(
      { candidate, financialReviewStatus: 'pending' },
      { status: 201 }
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
