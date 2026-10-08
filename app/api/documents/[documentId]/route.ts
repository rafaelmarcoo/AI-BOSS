import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  deleteUserDocument,
  updateDocumentCategory,
} from '@/lib/documents/persistence'
import { getDocumentDetails } from '@/lib/documents/review'
import { assertValid, readJsonBody } from '@/lib/api/validation'
import { validateUpdateDocumentCategoryPayload } from '@/lib/documents/review-validation'
import type {
  DeleteDocumentResponse,
  DocumentDetailsResponse,
  UpdateDocumentCategoryResponse,
} from '@/lib/documents/types'

interface RouteContext {
  params: Promise<{ documentId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const details = await getDocumentDetails(documentId, user.id)

    return successResponse<DocumentDetailsResponse>(details)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const result = await deleteUserDocument(documentId, user.id)

    return successResponse<DeleteDocumentResponse>({
      ...result,
      documentId,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { documentId } = await context.params
    const payload = assertValid(
      validateUpdateDocumentCategoryPayload(await readJsonBody(request))
    )
    const document = await updateDocumentCategory({
      documentId,
      requesterId: user.id,
      documentType: payload.documentType,
    })

    return successResponse<UpdateDocumentCategoryResponse>({ document })
  } catch (error) {
    return handleRouteError(error)
  }
}
