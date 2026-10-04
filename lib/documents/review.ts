import { ApiError } from '@/lib/api/errors'
import {
  getLatestDocumentExtractionReview,
} from '@/lib/documents/extraction-review-persistence'
import {
  createDocumentPreviewUrl,
  downloadDocumentFile,
  getAccessibleDocumentById,
  toDocumentSummary,
} from '@/lib/documents/persistence'
import { getUserCompany } from '@/lib/companies'
import { createAdminSupabaseClient } from '@/lib/supabase'
import {
  parseCsvTabularData,
  parseXlsxTabularData,
} from '@/lib/documents/tabular'
import type {
  DocumentDetailsResponse,
  DocumentPreviewResponse,
  DocumentReviewExtractionRun,
} from '@/lib/documents/types'

export const DOCUMENT_PREVIEW_DEFAULT_PAGE_SIZE = 100
export const DOCUMENT_PREVIEW_MAX_PAGE_SIZE = 100
export const DOCUMENT_PREVIEW_MAX_COLUMNS = 50

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
  const document = await getAccessibleDocumentById(documentId, userId)
  const company = await getUserCompany(userId)
  const review = await getLatestDocumentExtractionReview({
    documentId,
    userId: document.user_id,
  })

  const supabase = createAdminSupabaseClient()
  const { data: uploader } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', document.user_id)
    .maybeSingle()

  return {
    document: toDocumentSummary(
      document,
      userId,
      company.userType,
      uploader?.full_name?.trim() || uploader?.email || 'Company member'
    ),
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
  const document = await getAccessibleDocumentById(
    params.documentId,
    params.userId
  )

  if (document.file_type === 'pdf' || document.file_type === 'image') {
    const preview = await createDocumentPreviewUrl(
      params.documentId,
      params.userId
    )
    return document.file_type === 'pdf'
      ? { type: 'pdf', ...preview }
      : { type: 'image', ...preview, alt: document.file_name }
  }

  if (document.file_type === 'text' || document.file_type === 'docx') {
    return {
      type: 'text',
      text: document.raw_text ?? '',
    }
  }

  const fileBytes = await downloadDocumentFile(document.storage_path)
  const review =
    document.file_type === 'xlsx'
      ? await getLatestDocumentExtractionReview({
          documentId: params.documentId,
          userId: document.user_id,
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
