export const DOCUMENTS_STORAGE_BUCKET = 'documents'

// Keep the first upload slice conservative so we can validate the end-to-end
// storage and metadata flow before supporting larger ingestion workloads.
export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024

export const SUPPORTED_DOCUMENT_TYPES = ['pdf', 'csv', 'image'] as const

export type SupportedDocumentType = (typeof SUPPORTED_DOCUMENT_TYPES)[number]

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type SupportedImageMimeType = (typeof IMAGE_MIME_TYPES)[number]
