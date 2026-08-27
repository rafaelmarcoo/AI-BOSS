import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { assertValid, readJsonBody } from '@/lib/api/validation'
import { requireAuthenticatedUser } from '@/lib/auth'
import { confirmDocumentExtraction } from '@/lib/documents/extraction-review-persistence'
import { getDocumentById } from '@/lib/documents/persistence'
import { validateConfirmDocumentPayload } from '@/lib/documents/review-validation'
import type { ConfirmDocumentResponse } from '@/lib/documents/types'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    await getDocumentById(documentId, user.id)
    const payload = assertValid(
      validateConfirmDocumentPayload(await readJsonBody(request))
    )
    const includedObservationCount = await confirmDocumentExtraction({
      documentId,
      userId: user.id,
      extractionRunId: payload.extractionRunId,
      candidates: payload.candidates,
    })

    return successResponse<ConfirmDocumentResponse>({
      includedObservationCount,
      financialReviewStatus: 'confirmed',
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
