import { ApiError } from '@/lib/api/errors'
import {
  DOCUMENT_EMBEDDING_MODEL,
  embedDocumentChunks,
} from '@/lib/documents/embeddings'
import { logDocumentIngestion } from '@/lib/documents/log-document-ingestion'
import { parseDocumentContent } from '@/lib/documents/parsing'
import { extractTextFinancialMetrics } from '@/lib/documents/text-metric-extraction'
import type { ExtractedItem, ItemAttributes } from '@/lib/financial-data/attributes'
import {
  extractCsvFinancialData,
  findCsvValueIssues,
} from '@/lib/financial-data/extraction/csv'
import { extractPdfFinancialData } from '@/lib/financial-data/extraction/pdf'
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
  embeddingModel: string,
  valueIssues: ReturnType<typeof findCsvValueIssues> = [],
  customMetrics: Record<string, number> = {},
  itemAttributes: Record<string, ItemAttributes> = {},
  items: ExtractedItem[] = []
) {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}

  const existingCustomMetrics =
    base.extractedMetrics && typeof base.extractedMetrics === 'object' && !Array.isArray(base.extractedMetrics)
      ? (base.extractedMetrics as Record<string, number>)
      : {}
  const mergedCustomMetrics = { ...existingCustomMetrics, ...customMetrics }

  return {
    ...base,
    metricObservationCount,
    embeddingModel,
    ...(valueIssues.length > 0 ? { valueIssues } : {}),
    ...(Object.keys(mergedCustomMetrics).length > 0 ? { extractedMetrics: mergedCustomMetrics } : {}),
    // Sibling of extractedMetrics, keyed by the same item labels, so the
    // simple label -> number map stays untouched for everything that reads it.
    ...(Object.keys(itemAttributes).length > 0 ? { extractedMetricAttributes: itemAttributes } : {}),
    // Every extracted item including repeated labels, e.g. Icecream for
    // department A and for department B. The two maps above stay as the
    // simple first-occurrence view; anything item-level should read this.
    ...(items.length > 0 ? { extractedItems: items } : {}),
  }
}

// PDF, DOCX and plain text share one pipeline. The model reads the text we
// already extracted (so tables, several companies and extra columns like
// price/quantity are understood in context); the regex extractor stays as the
// fallback so an upload never fails just because the model call did.
async function getModelMetrics(params: {
  document: Awaited<ReturnType<typeof getDocumentById>>
  parsedDocument: ParsedDocumentResult
}) {
  const usesModelExtraction =
    params.document.file_type === 'pdf' ||
    params.document.file_type === 'text' ||
    params.document.file_type === 'docx'

  if (
    !usesModelExtraction ||
    !params.parsedDocument.rawText.trim() ||
    !process.env.OPENAI_API_KEY
  ) {
    return null
  }

  try {
    // One entry per PDF page. DOCX and plain text arrive as a single page and
    // are cut into pieces by the extractor itself.
    const pages = params.parsedDocument.pdfPages?.length
      ? params.parsedDocument.pdfPages.map((page) => page.text)
      : [params.parsedDocument.rawText]
    const result = await extractTextFinancialMetrics(pages, {
      documentId: params.document.id,
      sourceLabel: params.document.file_name,
      extractedAt: new Date().toISOString(),
    })

    return result && Object.keys(result.customMetrics).length > 0 ? result : null
  } catch (error) {
    console.error(
      `Model extraction failed for ${params.document.file_name}; using regex extraction instead.`,
      error
    )
    return null
  }
}

function getCsvMetrics(params: {
  document: Awaited<ReturnType<typeof getDocumentById>>
  parsedDocument: ParsedDocumentResult
}) {
  // XLSX sheets convert into the same csvData shape as CSV, so they share
  // this same deterministic label/amount matching logic.
  const isTabular = params.document.file_type === 'csv' || params.document.file_type === 'xlsx'

  if (!isTabular || !params.parsedDocument.csvData) {
    return {
      metrics: [],
      issues: [] as ReturnType<typeof findCsvValueIssues>,
      customMetrics: {} as Record<string, number>,
      items: [] as ExtractedItem[],
      itemAttributes: {} as Record<string, ItemAttributes>,
    }
  }

  const extractedAt = new Date().toISOString()
  const { metrics, customMetrics, items, itemAttributes } = extractCsvFinancialData({
    csvData: params.parsedDocument.csvData,
    documentId: params.document.id,
    sourceLabel: params.document.file_name,
    extractedAt,
  })
  const issues = findCsvValueIssues(params.parsedDocument.csvData)

  return { metrics, issues, customMetrics, items, itemAttributes }
}

function getPdfMetrics(params: {
  document: Awaited<ReturnType<typeof getDocumentById>>
  parsedDocument: ParsedDocumentResult
}) {
  // Plain text and DOCX both reuse PDF's page-based extraction (see
  // buildTextAsSinglePageResult), so they share this same line-matching
  // logic and the same requirement for a recognizable reporting-date phrase
  // somewhere in the text.
  const usesPdfExtraction =
    params.document.file_type === 'pdf' ||
    params.document.file_type === 'text' ||
    params.document.file_type === 'docx'

  if (!usesPdfExtraction || !params.parsedDocument.pdfPages) {
    return { metrics: [], customMetrics: {} as Record<string, number> }
  }

  return extractPdfFinancialData({
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
    const {
      metrics: csvMetrics,
      issues: csvValueIssues,
      customMetrics: csvCustomMetrics,
      items: csvItems,
      itemAttributes: csvItemAttributes,
    } = getCsvMetrics({ document, parsedDocument })
    const regexPdfResult = getPdfMetrics({ document, parsedDocument })
    const modelResult = await getModelMetrics({ document, parsedDocument })
    const pdfMetrics = modelResult ? modelResult.metrics : regexPdfResult.metrics
    const pdfCustomMetrics = modelResult
      ? modelResult.customMetrics
      : regexPdfResult.customMetrics
    const itemAttributes = { ...csvItemAttributes, ...modelResult?.itemAttributes }
    const items = [...csvItems, ...(modelResult?.items ?? [])]
    const customMetrics = { ...csvCustomMetrics, ...pdfCustomMetrics }

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
        extractor: modelResult ? 'llm_text_v1' : 'deterministic_pdf_v1',
        fileName: document.file_name,
      },
    })
    const metricObservationCount = csvMetrics.length + pdfMetrics.length
    const metadata = addMetricObservationCount(
      parsedDocument.metadata,
      metricObservationCount,
      DOCUMENT_EMBEDDING_MODEL,
      csvValueIssues,
      customMetrics,
      itemAttributes,
      items
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
