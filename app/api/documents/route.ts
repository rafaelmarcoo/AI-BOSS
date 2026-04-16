import { after } from 'next/server'
import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  createDocumentRecord,
  deleteDocumentFile,
  listUserDocuments,
  updateDocumentRecord,
  uploadDocumentFile,
} from '@/lib/documents/persistence'
import { processDocument } from '@/lib/documents/process'
import {
  readOptionalConversationId,
  validateDocumentUpload,
} from '@/lib/documents/validation'
import type {
  CreateDocumentResponse,
  DocumentsListResponse,
} from '@/lib/documents/types'

export const runtime = 'nodejs'

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

    let processingDocument

    try {
      const document = await createDocumentRecord({
        userId: user.id,
        fileName: file.name,
        fileType,
        mimeType: file.type || 'application/octet-stream',
        storagePath,
        conversationId,
      })
      processingDocument = await updateDocumentRecord(document.id, user.id, {
        status: 'processing',
        error_message: null,
      })
    } catch (error) {
      try {
        await deleteDocumentFile(storagePath)
      } catch (cleanupError) {
        console.error(
          `Failed to clean up uploaded file for ${file.name}.`,
          cleanupError
        )
      }

      throw error
    }

    after(async () => {
      await processDocument(processingDocument.id, user.id)
    })

    return successResponse<CreateDocumentResponse>(
      {
        document: processingDocument,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
