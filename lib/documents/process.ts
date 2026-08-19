import { ApiError } from '@/lib/api/errors'
import {
  DOCUMENT_EMBEDDING_MODEL,
  embedDocumentChunks,
} from '@/lib/documents/embeddings'
import { logDocumentIngestion } from '@/lib/documents/log-document-ingestion'
import { parseDocumentContent } from '@/lib/documents/parsing'
import { extractCsvFinancialMetrics } from '@/lib/financial-data/extraction/csv'
import { extractPdfFinancialMetrics } from '@/lib/financial-data/extraction/pdf'
import {
  deleteFinancialMetricObservationsForDocument,
  saveFinancialMetricObservations,
} from '@/lib/financial-data/persistence'
import {
  deleteDocumentFile,
  downloadDocumentFile,
  getDocumentById,
  replaceDocumentChunks,
  updateDocumentRecord,
} from '@/lib/documents/persistence'
import type { ParsedDocumentResult } from '@/lib/documents/types'

function addMetricObservationCount(
  metadata: unknown,
  metricObservationCount: number,
  embeddingModel: string
) {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return {
      ...metadata,
      metricObservationCount,
      embeddingModel,
    }
  }

  return {
    metricObservationCount,
    embeddingModel,
  }
}

function getCsvMetrics(params: {
  document: Awaited<ReturnType<typeof getDocumentById>>
  parsedDocument: ParsedDocumentResult
}) {
  if (params.document.file_type !== 'csv' || !params.parsedDocument.csvData) {
    return []
  }

  const extractedAt = new Date().toISOString()
  const metrics = extractCsvFinancialMetrics({
    csvData: params.parsedDocument.csvData,
    documentId: params.document.id,
    sourceLabel: params.document.file_name,
    extractedAt,
  })

  return metrics
}

function getPdfMetrics(params: {
  document: Awaited<ReturnType<typeof getDocumentById>>
  parsedDocument: ParsedDocumentResult
}) {
  if (params.document.file_type !== 'pdf' || !params.parsedDocument.pdfPages) {
    return []
  }

  return extractPdfFinancialMetrics({
    pages: params.parsedDocument.pdfPages,
    documentId: params.document.id,
    sourceLabel: params.document.file_name,
    extractedAt: new Date().toISOString(),
  })
}

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

    const embeddedChunks = await embedDocumentChunks(parsedDocument.chunks)

    await replaceDocumentChunks(document.id, document.user_id, embeddedChunks)
    const csvMetrics = getCsvMetrics({
      document,
      parsedDocument,
    })
    const pdfMetrics = getPdfMetrics({ document, parsedDocument })

    // Reprocessing must replace the document's derived metrics, not append stale values.
    await deleteFinancialMetricObservationsForDocument(document.id, document.user_id)
    await saveFinancialMetricObservations({
      userId: document.user_id,
      documentId: document.id,
      metrics: csvMetrics,
      rawData: {
        extractor: 'deterministic_csv_v1',
        fileName: document.file_name,
      },
    })
    await saveFinancialMetricObservations({
      userId: document.user_id,
      documentId: document.id,
      metrics: pdfMetrics,
      rawData: {
        extractor: 'deterministic_pdf_v1',
        fileName: document.file_name,
      },
    })
    const metricObservationCount = csvMetrics.length + pdfMetrics.length
    const metadata = addMetricObservationCount(
      parsedDocument.metadata,
      metricObservationCount,
      DOCUMENT_EMBEDDING_MODEL
    )

    await updateDocumentRecord(document.id, document.user_id, {
      status: 'ready',
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
    console.error(`processDocument failed for ${document.file_name}:`, error)
    const message =
      error instanceof Error ? error.message : 'Document processing failed.'

    try {
      await deleteFinancialMetricObservationsForDocument(document.id, document.user_id)
    } catch (cleanupError) {
      console.error(
        `Failed to clean up financial metrics for ${document.file_name}.`,
        cleanupError
      )
    }

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
