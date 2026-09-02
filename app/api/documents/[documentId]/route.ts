import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { deleteUserDocument } from '@/lib/documents/persistence'
import { getDocumentDetails } from '@/lib/documents/review'
import type {
  DeleteDocumentResponse,
  DocumentDetailsResponse,
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
