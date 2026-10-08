import { ApiError } from '@/lib/api/errors'
import {
  DOCUMENT_EMBEDDING_MODEL,
  embedDocumentChunks,
} from '@/lib/documents/embeddings'
import { logDocumentIngestion } from '@/lib/documents/log-document-ingestion'
import { extractAiAssistedDocument } from '@/lib/documents/ai-assisted-extraction'
import { parseDocumentContent } from '@/lib/documents/parsing'
import {
  extractDocumentCandidates,
  extractImageItems,
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
import type {
  DocumentExtractionCandidateDraft,
  ParsedDocumentResult,
  ProcessDocumentOptions,
} from '@/lib/documents/types'
import type { ExtractedItem } from '@/lib/financial-data/attributes'
import { createOcrChunks } from '@/lib/documents/chunking'
import {
  classifyDocumentCategory,
  normalizeDocumentCategory,
  type DocumentCategory,
} from '@/lib/documents/categories'

function addExtractionMetadata(
  metadata: unknown,
  params: {
    metricCandidateCount: number
    extractionRunId: string
    embeddingModel: string
    extractionMethod: 'deterministic' | 'ai_assisted' | 'hybrid'
    aiAssistedAttempted: boolean
    extractedItems?: ExtractedItem[]
    extractionWarnings?: Array<{ code: string; message: string }>
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

function mergeCandidates(
  deterministic: DocumentExtractionCandidateDraft[],
  aiAssisted: DocumentExtractionCandidateDraft[]
) {
  const merged = new Map<string, DocumentExtractionCandidateDraft>()

  const keyFor = (candidate: DocumentExtractionCandidateDraft) =>
    JSON.stringify(
      candidate.metricKey === null
        ? [null, candidate.value, candidate.currency, candidate.reportingDate]
        : [candidate.metricKey, candidate.currency, candidate.reportingDate]
    )

  for (const candidate of deterministic) {
    if (!merged.has(keyFor(candidate))) merged.set(keyFor(candidate), candidate)
  }

  for (const candidate of aiAssisted) {
    const key = keyFor(candidate)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, candidate)
      continue
    }

    if (
      existing.value !== candidate.value &&
      !existing.warnings.some((warning) => warning.code === 'ai_conflict_ignored')
    ) {
      existing.warnings.push({
        code: 'ai_conflict_ignored',
        message:
          'AI-assisted extraction found a different value for the same metric and reporting period. The deterministic value was retained for review.',
      })
    }
  }

  return [...merged.values()]
}

function deduplicateItems(items: ExtractedItem[]) {
  const unique = new Map<string, ExtractedItem>()
  for (const item of items) {
    const key = JSON.stringify([item.label.toLowerCase(), item.value, item.attributes])
    if (!unique.has(key)) unique.set(key, item)
  }
  return [...unique.values()]
}

function metadataCategorySource(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }
  return Reflect.get(metadata, 'documentCategorySource') === 'user'
    ? 'user'
    : null
}

function parsedPdfFallback(error: unknown): ParsedDocumentResult {
  return {
    rawText: '',
    metadata: {
      sourceType: 'pdf',
      deterministicExtractionFailed: true,
      warnings: [{
        code: 'deterministic_pdf_failed',
        message:
          error instanceof Error
            ? error.message
            : 'Deterministic PDF extraction failed.',
      }],
    },
    chunks: [],
    pdfPages: [],
    extractionState: 'scanned',
  }
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
  options: ProcessDocumentOptions = {}
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
    let parsedDocument: ParsedDocumentResult
    try {
      parsedDocument = await parseDocumentContent(document, fileBytes, options)
    } catch (error) {
      // Password-protected or otherwise invalid PDFs remain explicit failures.
      // Server/runtime extraction failures fall through to the bounded PDF
      // file fallback while the original storage object remains untouched.
      if (
        document.file_type !== 'pdf' ||
        (error instanceof ApiError && error.status < 500)
      ) {
        throw error
      }
      parsedDocument = parsedPdfFallback(error)
    }

    const deterministicCandidates = extractDocumentCandidates({
      document,
      parsedDocument,
      extractedAt: new Date().toISOString(),
    })
    const deterministicEvidenceAvailable =
      parsedDocument.rawText.trim().length > 0 ||
      parsedDocument.chunks.length > 0 ||
      deterministicCandidates.length > 0
    const supportsAiAssistance =
      document.file_type === 'pdf' ||
      document.file_type === 'csv' ||
      document.file_type === 'xlsx' ||
      document.file_type === 'text' ||
      document.file_type === 'docx'
    const shouldAttemptAi =
      supportsAiAssistance &&
      (options.extractionMode === 'ai_assisted' ||
        document.file_type === 'text' ||
        document.file_type === 'docx' ||
        deterministicCandidates.length === 0)
    const aiWarnings: Array<{ code: string; message: string }> = []
    let aiCandidates: DocumentExtractionCandidateDraft[] = []
    let extractedItems: ExtractedItem[] = extractImageItems(parsedDocument)
    let aiCategory: DocumentCategory | null = null
    let aiTranscription = ''
    let aiInputTruncated = false
    let aiAssistedSucceeded = false

    if (shouldAttemptAi) {
      if (!process.env.OPENAI_API_KEY) {
        aiWarnings.push({
          code: 'ai_assisted_unavailable',
          message:
            'AI-assisted extraction was not available. Deterministic results and the original document were retained.',
        })
      } else {
        try {
          const result = await extractAiAssistedDocument({
            document,
            parsedDocument,
            fileBytes,
          })
          aiCandidates = result.candidates
          extractedItems = deduplicateItems([...extractedItems, ...result.items])
          aiCategory = result.documentCategory
          aiTranscription = result.transcription
          aiInputTruncated = result.inputTruncated
          aiAssistedSucceeded = true
        } catch (error) {
          console.error(
            `AI-assisted extraction failed for ${document.file_name}.`,
            error
          )
          aiWarnings.push({
            code: 'ai_assisted_failed',
            message:
              'AI-assisted extraction failed. Deterministic results and the original document were retained.',
          })
        }
      }
    }

    if (!parsedDocument.rawText.trim() && aiTranscription) {
      parsedDocument = {
        ...parsedDocument,
        rawText: aiTranscription,
        chunks: createOcrChunks({
          documentId: document.id,
          userId: document.user_id,
          text: aiTranscription,
          source: document.file_type === 'pdf' ? 'pdf' : 'image',
        }),
      }
    }

    const candidates = mergeCandidates(deterministicCandidates, aiCandidates)

    if (aiInputTruncated) {
      aiWarnings.push({
        code: 'ai_input_truncated',
        message:
          'AI-assisted extraction inspected the first 120,000 characters. Deterministic parsing still inspected the complete file.',
      })
    }

    if (
      parsedDocument.chunks.length === 0 &&
      parsedDocument.extractionState !== 'scanned' &&
      candidates.length === 0
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
      warnings: [
        ...(tabularData?.warnings ?? metadataWarnings(parsedDocument.metadata)),
        ...aiWarnings,
      ],
    })

    const financialReviewStatus =
      candidates.length > 0 || extractedItems.length > 0
        ? 'pending'
        : document.financial_review_status === 'pending'
          ? 'not_required'
          : document.financial_review_status

    const previousCategorySource = metadataCategorySource(document.metadata)
    const automaticCategory =
      parsedDocument.imageExtraction?.documentCategory ??
      aiCategory ??
      classifyDocumentCategory({
        fileType: document.file_type,
        fileName: document.file_name,
        text: parsedDocument.rawText,
      })
    const documentCategory =
      previousCategorySource === 'user'
        ? normalizeDocumentCategory(document.document_type, document.file_type)
        : automaticCategory
    const metadata = addExtractionMetadata(
      parsedDocument.metadata,
      {
        metricCandidateCount: candidates.length,
        extractionRunId,
        embeddingModel: DOCUMENT_EMBEDDING_MODEL,
        extractionMethod:
          document.file_type === 'image'
            ? 'ai_assisted'
            : aiAssistedSucceeded
            ? deterministicEvidenceAvailable
              ? 'hybrid'
              : 'ai_assisted'
            : 'deterministic',
        aiAssistedAttempted: shouldAttemptAi || document.file_type === 'image',
        ...(extractedItems.length > 0 ? { extractedItems } : {}),
        ...(aiWarnings.length > 0 ? { extractionWarnings: aiWarnings } : {}),
      }
    )
    const categorizedMetadata = {
      ...(metadata as Record<string, unknown>),
      documentCategorySource:
        previousCategorySource === 'user' ? 'user' : 'automatic',
    }

    await updateDocumentRecord(document.id, document.user_id, {
      status: 'ready',
      financial_review_status: financialReviewStatus,
      document_type: documentCategory,
      raw_text: parsedDocument.rawText,
      metadata: categorizedMetadata,
      error_message: null,
    })
    await logDocumentIngestion({
      userId: document.user_id,
      documentId: document.id,
      conversationId: document.conversation_id,
      fileName: document.file_name,
      status: 'ready',
      chunkCount: parsedDocument.chunks.length,
      metadata: categorizedMetadata,
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
