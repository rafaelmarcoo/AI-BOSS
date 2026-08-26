export const DOCUMENTS_STORAGE_BUCKET = 'documents'

// Keep the first upload slice conservative so we can validate the end-to-end
// storage and metadata flow before supporting larger ingestion workloads.
export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024

export const SUPPORTED_DOCUMENT_TYPES = ['pdf', 'csv', 'xlsx'] as const

export const MAX_XLSX_WORKSHEETS = 25
export const MAX_SELECTED_TABULAR_ROWS = 50_000
export const MAX_TABULAR_COLUMNS = 200

export type SupportedDocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number]
