import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { assertValid, readJsonBody } from '@/lib/api/validation'
import { requireAuthenticatedUser } from '@/lib/auth'
import { saveDocumentExtractionReviewDraft } from '@/lib/documents/extraction-review-persistence'
import { getAccessibleDocumentById } from '@/lib/documents/persistence'
import { validateSaveDocumentReviewDraftPayload } from '@/lib/documents/review-validation'
import type { SaveDocumentReviewDraftResponse } from '@/lib/documents/types'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const document = await getAccessibleDocumentById(documentId, user.id)
    const payload = assertValid(
      validateSaveDocumentReviewDraftPayload(await readJsonBody(request))
    )

    await saveDocumentExtractionReviewDraft({
      documentId,
      ownerUserId: document.user_id,
      reviewerUserId: user.id,
      extractionRunId: payload.extractionRunId,
      candidates: payload.candidates,
    })

    return successResponse<SaveDocumentReviewDraftResponse>({ saved: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
