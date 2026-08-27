import type { Document } from '@/types/database'
import type { FinancialMetricKey } from '@/lib/financial-data'

export type DocumentSummary = Pick<
  Document,
  | 'id'
  | 'conversation_id'
  | 'file_name'
  | 'file_type'
  | 'mime_type'
  | 'storage_path'
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
