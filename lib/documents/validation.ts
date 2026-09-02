import { ApiError } from '@/lib/api/errors'
import {
  MAX_DOCUMENT_SIZE_BYTES,
  SUPPORTED_DOCUMENT_TYPES,
  SupportedDocumentType,
} from '@/lib/documents/constants'

const PDF_MIME_TYPES = ['application/pdf']
const CSV_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]
const XLSX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function getFileExtension(fileName: string) {
  const extension = fileName.split('.').pop()

  return extension ? extension.toLowerCase() : ''
}

function detectDocumentType(file: File): SupportedDocumentType | null {
  const extension = getFileExtension(file.name)
  const mimeType = file.type.toLowerCase()

  if (extension === 'pdf') return 'pdf'
  if (extension === 'csv') return 'csv'
  if (extension === 'xlsx') return 'xlsx'

  // A named file with an unsupported extension must not become supported only
  // because the browser supplied a broad or incorrect MIME type.
  if (extension) return null

  if (PDF_MIME_TYPES.includes(mimeType)) return 'pdf'
  if (CSV_MIME_TYPES.includes(mimeType)) return 'csv'
  if (XLSX_MIME_TYPES.includes(mimeType)) return 'xlsx'

  return null
}

export function readOptionalConversationId(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed ? trimmed : null
}

export function validateDocumentUpload(
  value: FormDataEntryValue | null
): {
  file: File
  fileType: SupportedDocumentType
} {
  if (!(value instanceof File)) {
    throw new ApiError(400, 'BAD_REQUEST', 'A file upload is required.')
  }

  if (!value.name.trim()) {
    throw new ApiError(400, 'BAD_REQUEST', 'Uploaded file must have a name.')
  }

  if (value.size === 0) {
    throw new ApiError(400, 'BAD_REQUEST', 'Uploaded file is empty.')
  }

  if (value.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `Uploaded file exceeds the ${Math.round(
        MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)
      )} MB size limit.`
    )
  }

  const fileType = detectDocumentType(value)

  if (!fileType || !SUPPORTED_DOCUMENT_TYPES.includes(fileType)) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'Only PDF, CSV, and XLSX uploads are supported.'
    )
  }

  return {
    file: value,
    fileType,
  }
}
