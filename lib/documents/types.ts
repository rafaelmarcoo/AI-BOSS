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
