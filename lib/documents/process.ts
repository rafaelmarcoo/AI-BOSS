import { ApiError } from '@/lib/api/errors'
import {
  DOCUMENT_EMBEDDING_MODEL,
  embedDocumentChunks,
} from '@/lib/documents/embeddings'
import { logDocumentIngestion } from '@/lib/documents/log-document-ingestion'
import { parseDocumentContent } from '@/lib/documents/parsing'
import {
  extractDocumentCandidates,
  getDocumentExtractorVersion,
} from '@/lib/documents/extraction-candidates'
import {
  completeDocumentExtractionRun,
  createDocumentExtractionRun,
  failDocumentExtractionRun,
  saveDocumentExtractionCandidates,
} from '@/lib/documents/extraction-review-persistence'
import {
  downloadDocumentFile,
  getDocumentById,
  replaceDocumentChunks,
  updateDocumentRecord,
} from '@/lib/documents/persistence'
import type { ParseDocumentOptions } from '@/lib/documents/types'

function addExtractionMetadata(
  metadata: unknown,
  params: {
    metricCandidateCount: number
    extractionRunId: string
    embeddingModel: string
  }
) {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return {
      ...metadata,
      ...params,
    }
  }

  return params
}

function metadataWarnings(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return []
  }

  const warnings = (metadata as { warnings?: unknown }).warnings
  return Array.isArray(warnings) ? warnings : []
}

export async function processDocument(
  documentId: string,
  userId: string,
  options: ParseDocumentOptions = {}
) {
  const startedAt = Date.now()
  const document = await getDocumentById(documentId, userId)
  let extractionRunId: string | null = null

  try {
    const extractionRun = await createDocumentExtractionRun({
      documentId: document.id,
      userId: document.user_id,
      extractorVersion: getDocumentExtractorVersion(document.file_type),
    })
    extractionRunId = extractionRun.id
    const fileBytes = await downloadDocumentFile(document.storage_path)
    const parsedDocument = await parseDocumentContent(document, fileBytes, options)

    if (
      parsedDocument.chunks.length === 0 &&
      parsedDocument.extractionState !== 'scanned'
    ) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `No retrieval chunks could be created for ${document.file_name}.`
      )
    }

    const embeddedChunks =
      parsedDocument.chunks.length > 0
        ? await embedDocumentChunks(parsedDocument.chunks)
        : []

    // Reprocessing replaces retrieval evidence even when a scanned PDF has no
    // extractable text, so stale chunks from an earlier run cannot be cited.
    await replaceDocumentChunks(document.id, document.user_id, embeddedChunks)
    const candidates = extractDocumentCandidates({
      document,
      parsedDocument,
      extractedAt: new Date().toISOString(),
    })
    await saveDocumentExtractionCandidates({
      extractionRunId,
      documentId: document.id,
      userId: document.user_id,
      candidates,
    })

    const tabularData = parsedDocument.tabularData
    await completeDocumentExtractionRun({
      extractionRunId,
      documentId: document.id,
      userId: document.user_id,
      selectedWorksheetNames: tabularData?.selectedSheetNames ?? [],
      suggestedWorksheetNames: tabularData?.suggestedSheetNames ?? [],
      worksheetMetadata: tabularData?.worksheetMetadata ?? [],
      warnings: tabularData?.warnings ?? metadataWarnings(parsedDocument.metadata),
    })

    const financialReviewStatus =
      candidates.length > 0
        ? 'pending'
        : document.financial_review_status === 'pending'
          ? 'not_required'
          : document.financial_review_status
    const metadata = addExtractionMetadata(
      parsedDocument.metadata,
      {
        metricCandidateCount: candidates.length,
        extractionRunId,
        embeddingModel: DOCUMENT_EMBEDDING_MODEL,
      }
    )

    await updateDocumentRecord(document.id, document.user_id, {
      status: 'ready',
      financial_review_status: financialReviewStatus,
      raw_text: parsedDocument.rawText,
      metadata,
      error_message: null,
    })
    await logDocumentIngestion({
      userId: document.user_id,
      documentId: document.id,
      conversationId: document.conversation_id,
      fileName: document.file_name,
      status: 'ready',
      chunkCount: parsedDocument.chunks.length,
      metadata,
      errorMessage: null,
      responseTimeMs: Date.now() - startedAt,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Document processing failed.'

    if (extractionRunId) {
      try {
        await failDocumentExtractionRun({
          extractionRunId,
          documentId: document.id,
          userId: document.user_id,
          errorMessage: message,
        })
      } catch (runError) {
        console.error(
          `Failed to record extraction failure for ${document.file_name}.`,
          runError
        )
      }
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
