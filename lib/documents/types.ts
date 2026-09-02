import type { Document } from '@/types/database'
import type { FinancialMetricKey } from '@/lib/financial-data'
import type {
  DocumentExtractionCandidate,
  DocumentExtractionRun,
} from '@/types/database'

export type DocumentSummary = Pick<
  Document,
  | 'id'
  | 'conversation_id'
  | 'file_name'
  | 'file_type'
  | 'mime_type'
  | 'status'
  | 'financial_review_status'
  | 'document_type'
  | 'metadata'
  | 'error_message'
  | 'created_at'
  | 'updated_at'
>

export interface DocumentsListResponse {
  documents: DocumentSummary[]
}

export interface CreateDocumentResponse {
  document: DocumentSummary
}

export interface DeleteDocumentResponse {
  deleted: boolean
  documentId: string
}

export type DocumentReviewCandidate = Omit<
  DocumentExtractionCandidate,
  'user_id' | 'document_id'
>

export type DocumentReviewExtractionRun = Omit<
  DocumentExtractionRun,
  'user_id' | 'document_id'
>

export interface DocumentDetailsResponse {
  document: DocumentSummary
  extractionRun: DocumentReviewExtractionRun | null
  candidates: DocumentReviewCandidate[]
}

export interface PdfDocumentPreviewResponse {
  type: 'pdf'
  url: string
  expiresAt: string
}

export interface TabularDocumentPreviewResponse {
  type: 'table'
  sheetName: string
  availableSheets: Array<{
    name: string
    visibility: ParsedTabularSheet['visibility']
    suggested: boolean
    empty: boolean
  }>
  headers: string[]
  rows: Array<{ rowNumber: number; values: string[] }>
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
  displayedColumnCount: number
  totalColumnCount: number
  warnings: TabularWarning[]
}

export type DocumentPreviewResponse =
  | PdfDocumentPreviewResponse
  | TabularDocumentPreviewResponse

export interface ReprocessDocumentResponse {
  document: DocumentSummary
}

export interface ConfirmDocumentResponse {
  includedObservationCount: number
  financialReviewStatus: 'confirmed'
}

export interface ReviewedDocumentCandidateInput {
  candidateId: string
  decision: 'included' | 'excluded'
  metricKey: FinancialMetricKey | null
  value: number | null
  currency: 'NZD' | 'AUD' | null
  reportingDate: string | null
}

export interface DocumentChunkInsert {
  document_id: string
  user_id: string
  chunk_index: number
  content: string
  source_page: number | null
  metadata: unknown
  embedding: number[] | null
}

export interface ParsedPdfPage {
  pageNumber: number
  text: string
  lines?: string[]
}

export interface ParsedCsvRow {
  rowNumber: number
  values: string[]
  cells: Record<string, string>
}

export interface ParsedCsvData {
  headers: string[]
  rows: ParsedCsvRow[]
}

export interface TabularWarning {
  code: string
  message: string
  sheetName?: string
  rowNumber?: number
  columnNumber?: number
}

export interface ParsedTabularSheet {
  name: string
  visibility: 'visible' | 'hidden' | 'veryHidden'
  headers: string[]
  rows: ParsedCsvRow[]
  headerRowNumber: number
  nonEmptyRowCount: number
  columnCount: number
  warnings: TabularWarning[]
}

export interface TabularSheetMetadata {
  name: string
  visibility: ParsedTabularSheet['visibility']
  nonEmptyRowCount: number
  columnCount: number
  suggested: boolean
  empty: boolean
}

export interface ParsedTabularData {
  sourceType: 'csv' | 'xlsx'
  sheets: ParsedTabularSheet[]
  selectedSheetNames: string[]
  suggestedSheetNames: string[]
  worksheetMetadata: TabularSheetMetadata[]
  warnings: TabularWarning[]
}

export interface ParseDocumentOptions {
  selectedWorksheetNames?: string[]
}

export interface DocumentExtractionCandidateDraft {
  originalPayload: Record<string, unknown>
  metricKey: FinancialMetricKey | null
  value: number | null
  currency: 'NZD' | 'AUD' | null
  reportingDate: string | null
  confidence: number | null
  evidence: Record<string, unknown>
  warnings: TabularWarning[]
  extractorVersion: string
}

export interface ParsedDocumentResult {
  rawText: string
  metadata: unknown
  chunks: DocumentChunkInsert[]
  extractionState?: 'text' | 'scanned'
  csvData?: ParsedCsvData
  tabularData?: ParsedTabularData
  pdfPages?: ParsedPdfPage[]
}
