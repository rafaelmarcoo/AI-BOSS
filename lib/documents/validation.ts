import { ApiError } from '@/lib/api/errors'
import {
  IMAGE_MIME_TYPES,
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
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

function getFileExtension(fileName: string) {
  const extension = fileName.split('.').pop()

  return extension ? extension.toLowerCase() : ''
}

function detectDocumentType(file: File): SupportedDocumentType | null {
  const extension = getFileExtension(file.name)

  if (
    extension === 'pdf' ||
    PDF_MIME_TYPES.includes(file.type.toLowerCase())
  ) {
    return 'pdf'
  }

  if (
    extension === 'csv' ||
    CSV_MIME_TYPES.includes(file.type.toLowerCase())
  ) {
    return 'csv'
  }

  if (
    IMAGE_EXTENSIONS.includes(extension) ||
    IMAGE_MIME_TYPES.includes(
      file.type.toLowerCase() as (typeof IMAGE_MIME_TYPES)[number]
    )
  ) {
    return 'image'
  }

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
      'Only PDF, CSV, and image (JPEG, PNG, WebP) uploads are supported right now.'
    )
  }

  return {
    file: value,
    fileType,
  }
}
