import { after, NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { assertValid, readJsonBody } from '@/lib/api/validation'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  getDocumentById,
  updateDocumentRecord,
} from '@/lib/documents/persistence'
import { processDocument } from '@/lib/documents/process'
import { validateReprocessDocumentPayload } from '@/lib/documents/review-validation'
import type { ReprocessDocumentResponse } from '@/lib/documents/types'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const document = await getDocumentById(documentId, user.id)
    const payload = assertValid(
      validateReprocessDocumentPayload(await readJsonBody(request))
    )

    if (document.status === 'processing') {
      throw new ApiError(
        409,
        'CONFLICT',
        'This document is already being processed.'
      )
    }

    if (
      document.file_type !== 'xlsx' &&
      (payload.selectedWorksheetNames?.length ?? 0) > 0
    ) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Worksheet selection is available only for XLSX documents.'
      )
    }

    const processingDocument = await updateDocumentRecord(document.id, user.id, {
      status: 'processing',
      error_message: null,
    })

    after(async () => {
      await processDocument(document.id, user.id, {
        selectedWorksheetNames: payload.selectedWorksheetNames,
      })
    })

    return successResponse<ReprocessDocumentResponse>(
      { document: processingDocument },
      { status: 202 }
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
