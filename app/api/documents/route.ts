import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  createDocumentRecord,
  listUserDocuments,
  uploadDocumentFile,
} from '@/lib/documents/persistence'
import {
  readOptionalConversationId,
  validateDocumentUpload,
} from '@/lib/documents/validation'
import type {
  CreateDocumentResponse,
  DocumentsListResponse,
} from '@/lib/documents/types'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const documents = await listUserDocuments(user.id)

    return successResponse<DocumentsListResponse>({
      documents,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const formData = await request.formData()
    const { file, fileType } = validateDocumentUpload(formData.get('file'))
    const conversationId = readOptionalConversationId(
      formData.get('conversationId')
    )
    const { storagePath } = await uploadDocumentFile({
      userId: user.id,
      file,
    })
    const document = await createDocumentRecord({
      userId: user.id,
      fileName: file.name,
      fileType,
      mimeType: file.type || 'application/octet-stream',
      storagePath,
      conversationId,
    })

    return successResponse<CreateDocumentResponse>(
      {
        document,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
