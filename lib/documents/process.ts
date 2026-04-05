import { ApiError } from '@/lib/api/errors'
import { logDocumentIngestion } from '@/lib/documents/log-document-ingestion'
import { parseDocumentContent } from '@/lib/documents/parsing'
import {
  deleteDocumentFile,
  downloadDocumentFile,
  getDocumentById,
  replaceDocumentChunks,
  updateDocumentRecord,
} from '@/lib/documents/persistence'

export async function processDocument(documentId: string, userId: string) {
  const startedAt = Date.now()
  const document = await getDocumentById(documentId, userId)

  try {
    const fileBytes = await downloadDocumentFile(document.storage_path)
    const parsedDocument = await parseDocumentContent(document, fileBytes)

    if (parsedDocument.chunks.length === 0) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `No retrieval chunks could be created for ${document.file_name}.`
      )
    }

    await replaceDocumentChunks(document.id, document.user_id, parsedDocument.chunks)
    await updateDocumentRecord(document.id, document.user_id, {
      status: 'ready',
      raw_text: parsedDocument.rawText,
      metadata: parsedDocument.metadata,
      error_message: null,
    })
    await logDocumentIngestion({
      userId: document.user_id,
      documentId: document.id,
      conversationId: document.conversation_id,
      fileName: document.file_name,
      status: 'ready',
      chunkCount: parsedDocument.chunks.length,
      metadata: parsedDocument.metadata,
      errorMessage: null,
      responseTimeMs: Date.now() - startedAt,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Document processing failed.'

    try {
      await deleteDocumentFile(document.storage_path)
    } catch (cleanupError) {
      console.error(
        `Failed to clean up storage object for ${document.file_name}.`,
        cleanupError
      )
    }

    await updateDocumentRecord(document.id, document.user_id, {
      status: 'failed',
      error_message: message,
    })
    await logDocumentIngestion({
      userId: document.user_id,
      documentId: document.id,
      conversationId: document.conversation_id,
      fileName: document.file_name,
      status: 'failed',
      chunkCount: 0,
      metadata: null,
      errorMessage: message,
      responseTimeMs: Date.now() - startedAt,
    })
  }
}
