import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { deleteUserDocument } from '@/lib/documents/persistence'
import type { DeleteDocumentResponse } from '@/lib/documents/types'

interface RouteContext {
  params: Promise<{ documentId: string }>
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
