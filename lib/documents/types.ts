import type { Document } from '@/types/database'

export type DocumentSummary = Pick<
  Document,
  | 'id'
  | 'conversation_id'
  | 'file_name'
  | 'file_type'
  | 'mime_type'
  | 'storage_path'
  | 'status'
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

export interface ParsedDocumentResult {
  rawText: string
  metadata: unknown
  chunks: DocumentChunkInsert[]
  csvData?: ParsedCsvData
  pdfPages?: ParsedPdfPage[]
}
