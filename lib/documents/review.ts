import { ApiError } from '@/lib/api/errors'
import {
  getLatestDocumentExtractionReview,
} from '@/lib/documents/extraction-review-persistence'
import {
  createPdfDocumentPreviewUrl,
  downloadDocumentFile,
  getDocumentById,
} from '@/lib/documents/persistence'
import {
  parseCsvTabularData,
  parseXlsxTabularData,
} from '@/lib/documents/tabular'
import type {
  DocumentDetailsResponse,
  DocumentPreviewResponse,
  DocumentReviewExtractionRun,
  DocumentSummary,
} from '@/lib/documents/types'
import type { Document } from '@/types/database'

export const DOCUMENT_PREVIEW_DEFAULT_PAGE_SIZE = 100
export const DOCUMENT_PREVIEW_MAX_PAGE_SIZE = 100
export const DOCUMENT_PREVIEW_MAX_COLUMNS = 50

function toDocumentSummary(document: Document): DocumentSummary {
  return {
    id: document.id,
    conversation_id: document.conversation_id,
    file_name: document.file_name,
    file_type: document.file_type,
    mime_type: document.mime_type,
    status: document.status,
    financial_review_status: document.financial_review_status,
    document_type: document.document_type,
    metadata: document.metadata,
    error_message: document.error_message,
    created_at: document.created_at,
    updated_at: document.updated_at,
  }
}

function toReviewExtractionRun(
  run: Awaited<ReturnType<typeof getLatestDocumentExtractionReview>>['extractionRun']
): DocumentReviewExtractionRun | null {
  if (!run) return null

  return {
    id: run.id,
    status: run.status,
    selected_worksheet_names: run.selected_worksheet_names,
    suggested_worksheet_names: run.suggested_worksheet_names,
    worksheet_metadata: run.worksheet_metadata,
    warnings: run.warnings,
    extractor_version: run.extractor_version,
    error_message: run.error_message,
    started_at: run.started_at,
    completed_at: run.completed_at,
    confirmed_at: run.confirmed_at,
    superseded_at: run.superseded_at,
    created_at: run.created_at,
    updated_at: run.updated_at,
  }
}

export async function getDocumentDetails(
  documentId: string,
  userId: string
): Promise<DocumentDetailsResponse> {
  const document = await getDocumentById(documentId, userId)
  const review = await getLatestDocumentExtractionReview({ documentId, userId })

  return {
    document: toDocumentSummary(document),
    extractionRun: toReviewExtractionRun(review.extractionRun),
    candidates: review.candidates,
  }
}

export async function getDocumentPreview(params: {
  documentId: string
  userId: string
  page: number
  pageSize: number
  sheetName?: string
}): Promise<DocumentPreviewResponse> {
  const document = await getDocumentById(params.documentId, params.userId)

  if (document.file_type === 'pdf') {
    const preview = await createPdfDocumentPreviewUrl(
      params.documentId,
      params.userId
    )
    return { type: 'pdf', ...preview }
  }

  const fileBytes = await downloadDocumentFile(document.storage_path)
  const review =
    document.file_type === 'xlsx'
      ? await getLatestDocumentExtractionReview({
          documentId: params.documentId,
          userId: params.userId,
        })
      : null
  const selectedSheetName =
    params.sheetName ?? review?.extractionRun?.selected_worksheet_names[0]
  const tabularData =
    document.file_type === 'csv'
      ? parseCsvTabularData(fileBytes)
      : await parseXlsxTabularData(
          fileBytes,
          selectedSheetName ? [selectedSheetName] : undefined
        )
  const sheet = tabularData.sheets[0]

  if (!sheet) {
    throw new ApiError(404, 'NOT_FOUND', 'No previewable worksheet was found.')
  }

  const pageSize = Math.min(
    DOCUMENT_PREVIEW_MAX_PAGE_SIZE,
    Math.max(1, params.pageSize)
  )
  const page = Math.max(1, params.page)
  const totalRows = sheet.rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const start = (page - 1) * pageSize
  const headers = sheet.headers.slice(0, DOCUMENT_PREVIEW_MAX_COLUMNS)

  return {
    type: 'table',
    sheetName: sheet.name,
    availableSheets: tabularData.worksheetMetadata.map((metadata) => ({
      name: metadata.name,
      visibility: metadata.visibility,
      suggested: metadata.suggested,
      empty: metadata.empty,
    })),
    headers,
    rows: sheet.rows.slice(start, start + pageSize).map((row) => ({
      rowNumber: row.rowNumber,
      values: row.values.slice(0, DOCUMENT_PREVIEW_MAX_COLUMNS),
    })),
    page,
    pageSize,
    totalRows,
    totalPages,
    displayedColumnCount: headers.length,
    totalColumnCount: sheet.columnCount,
    warnings: sheet.warnings,
  }
}

export { toDocumentSummary }
