import { randomUUID } from 'crypto'
import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'
import {
  DOCUMENTS_STORAGE_BUCKET,
  IMAGE_MIME_TYPES,
} from '@/lib/documents/constants'
import { getUserCompany } from '@/lib/companies'
import type { Document, DocumentChunk, DocumentDeletionResult } from '@/types/database'
import type { DocumentChunkInsert, DocumentSummary } from '@/lib/documents/types'
import type { SupportedDocumentType } from '@/lib/documents/constants'
import {
  applyItemAppend,
  applyItemAttributeEdit,
  applyItemValueEdit,
  type AttributeChanges,
} from '@/lib/financial-data/item-matrix'
import {
  resolveItemValue,
  type ItemAttributes,
} from '@/lib/financial-data/attributes'

const DOCUMENT_SUMMARY_SELECT = `
  id,
  user_id,
  company_id,
  conversation_id,
  file_name,
  file_type,
  mime_type,
  status,
  financial_review_status,
  document_type,
  metadata,
  error_message,
  created_at,
  updated_at
`

const DOCUMENT_FULL_SELECT = `
  id,
  user_id,
  company_id,
  conversation_id,
  file_name,
  file_type,
  mime_type,
  storage_path,
  status,
  financial_review_status,
  document_type,
  raw_text,
  metadata,
  error_message,
  created_at,
  updated_at
`

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function createStoragePath(userId: string, fileName: string) {
  return `${userId}/${randomUUID()}-${sanitizeFileName(fileName)}`
}

type DocumentSummaryRow = Pick<
  Document,
  | 'id'
  | 'user_id'
  | 'company_id'
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

export function documentAccess(
  document: Pick<Document, 'user_id' | 'financial_review_status'>,
  requesterId: string,
  requesterType: 'admin' | 'employee' | null
) {
  const isOwner = document.user_id === requesterId
  const isAdmin = requesterType === 'admin'

  return {
    isOwner,
    canSaveDraft: isOwner || isAdmin,
    canConfirm: isAdmin,
    canDelete: isAdmin || (isOwner && document.financial_review_status !== 'confirmed'),
  }
}

export function toDocumentSummary(
  row: DocumentSummaryRow,
  requesterId: string,
  requesterType: 'admin' | 'employee' | null,
  uploaderLabel: string
): DocumentSummary {
  return {
    ...row,
    uploadedBy: { id: row.user_id, label: uploaderLabel },
    access: documentAccess(row, requesterId, requesterType),
  }
}

async function ensureDocumentsBucketExists() {
  const supabase = createAdminSupabaseClient()
  const bucketOptions = {
    public: false,
    fileSizeLimit: '15MB',
    allowedMimeTypes: [
      'application/pdf',
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      ...IMAGE_MIME_TYPES,
    ],
  }
  const { data, error } = await supabase.storage.listBuckets()

  if (error) {
    console.error('Failed to list Supabase storage buckets.', error)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to access document storage.',
      error.message
    )
  }

  const existingBucket = data?.find(
    (bucket) => bucket.name === DOCUMENTS_STORAGE_BUCKET
  )

  if (existingBucket) {
    const { error: updateError } = await supabase.storage.updateBucket(
      DOCUMENTS_STORAGE_BUCKET,
      bucketOptions
    )

    if (updateError) {
      console.error('Failed to update the document storage bucket.', updateError)
      throw new ApiError(
        500,
        'INTERNAL_ERROR',
        'Failed to configure document storage.',
        updateError.message
      )
    }

    return
  }

  const { error: createError } = await supabase.storage.createBucket(
    DOCUMENTS_STORAGE_BUCKET,
    bucketOptions
  )

  if (createError && createError.message !== 'Bucket already exists') {
    console.error('Failed to create Supabase storage bucket.', createError)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to initialize document storage.',
      createError.message
    )
  }
}

export async function listUserDocuments(userId: string) {
  const supabase = createAdminSupabaseClient()
  const company = await getUserCompany(userId)
  let query = supabase
    .from('documents')
    .select(DOCUMENT_SUMMARY_SELECT)
    .order('created_at', { ascending: false })

  query = company.userType === 'admin'
    ? query.eq('company_id', company.id)
    : query.eq('user_id', userId)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load documents.')
  }

  const rows = (data ?? []) as DocumentSummaryRow[]
  const uploaderIds = [...new Set(rows.map((row) => row.user_id))]
  const { data: uploaders, error: uploaderError } = uploaderIds.length === 0
    ? { data: [], error: null }
    : await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', uploaderIds)

  if (uploaderError) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load document uploaders.')
  }

  const labels = new Map(
    (uploaders ?? []).map((uploader) => [
      uploader.id,
      uploader.full_name?.trim() || uploader.email,
    ])
  )

  return rows.map((row) =>
    toDocumentSummary(
      row,
      userId,
      company.userType,
      labels.get(row.user_id) ?? 'Company member'
    )
  )
}

export async function uploadDocumentFile(params: {
  userId: string
  file: File
}) {
  await ensureDocumentsBucketExists()

  const supabase = createAdminSupabaseClient()
  const storagePath = createStoragePath(params.userId, params.file.name)
  const { error } = await supabase.storage
    .from(DOCUMENTS_STORAGE_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type || undefined,
      upsert: false,
    })

  if (error) {
    console.error('Failed to upload document file to Supabase Storage.', error)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to upload document file.',
      error.message
    )
  }

  return {
    storagePath,
  }
}

export async function deleteDocumentFile(storagePath: string) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.storage
    .from(DOCUMENTS_STORAGE_BUCKET)
    .remove([storagePath])

  if (error) {
    console.error(
      'Failed to delete document file from Supabase Storage.',
      error
    )
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to clean up document file.',
      error.message
    )
  }
}

/**
 * Removes the Storage file first, then uses a database transaction to remove
 * the document, its RAG chunks, and any deterministic metrics extracted from it.
 */
export async function deleteUserDocument(documentId: string, userId: string) {
  const document = await getAccessibleDocumentById(documentId, userId)
  const company = await getUserCompany(userId)
  const access = documentAccess(document, userId, company.userType)

  if (!access.canDelete) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Only a company administrator can delete a confirmed document.'
    )
  }

  await deleteDocumentFile(document.storage_path)

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc(
    'delete_company_document_and_derived_metrics',
    {
      p_document_id: documentId,
      p_requester_id: userId,
    }
  )

  if (error || data !== true) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to remove the document data.',
      error?.message
    )
  }

  return { deleted: true } satisfies DocumentDeletionResult
}

export async function createDocumentRecord(params: {
  userId: string
  companyId: string
  userType: 'admin' | 'employee' | null
  fileName: string
  fileType: SupportedDocumentType
  mimeType: string
  storagePath: string
  conversationId: string | null
}) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: params.userId,
      company_id: params.companyId,
      conversation_id: params.conversationId,
      file_name: params.fileName,
      file_type: params.fileType,
      mime_type: params.mimeType,
      storage_path: params.storagePath,
      status: 'uploaded',
      financial_review_status: 'pending',
      metadata: null,
    })
    .select(DOCUMENT_SUMMARY_SELECT)
    .single()

  if (error || !data) {
    console.error('Failed to create document row.', error)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to create document.',
      error?.message
    )
  }

  return toDocumentSummary(
    data as DocumentSummaryRow,
    params.userId,
    params.userType,
    'You'
  )
}

export async function getDocumentById(documentId: string, userId: string) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_FULL_SELECT)
    .eq('id', documentId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new ApiError(404, 'NOT_FOUND', 'Document not found.')
  }

  return data as Document
}

export async function getAccessibleDocumentById(
  documentId: string,
  requesterId: string
) {
  const company = await getUserCompany(requesterId)
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_FULL_SELECT)
    .eq('id', documentId)
    .single()

  if (error || !data) {
    throw new ApiError(404, 'NOT_FOUND', 'Document not found.')
  }

  const document = data as Document
  const isOwner = document.user_id === requesterId
  const isCompanyAdmin =
    company.userType === 'admin' && document.company_id === company.id

  if (!isOwner && !isCompanyAdmin) {
    throw new ApiError(404, 'NOT_FOUND', 'Document not found.')
  }

  return document
}

export async function updateDocumentRecord(
  documentId: string,
  ownerUserId: string,
  updates: Partial<
    Pick<
      Document,
      | 'status'
      | 'financial_review_status'
      | 'raw_text'
      | 'metadata'
      | 'error_message'
    >
  >,
  requesterId = ownerUserId
) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .eq('user_id', ownerUserId)
    .select(DOCUMENT_SUMMARY_SELECT)
    .single()

  if (error || !data) {
    console.error('Failed to update document row.', error)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to update document.',
      error?.message
    )
  }

  const company = await getUserCompany(requesterId)
  return toDocumentSummary(
    data as DocumentSummaryRow,
    requesterId,
    company.userType,
    'You'
  )
}

async function getEditableDocument(documentId: string, requesterId: string) {
  const document = await getAccessibleDocumentById(documentId, requesterId)
  const company = await getUserCompany(requesterId)
  const access = documentAccess(document, requesterId, company.userType)

  if (!access.canSaveDraft) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'You are not allowed to edit this document.'
    )
  }

  return document
}

export async function updateDocumentExtractedItem(params: {
  documentId: string
  requesterId: string
  index: number
  value?: number
  attributes?: AttributeChanges
}) {
  const document = await getEditableDocument(params.documentId, params.requesterId)
  let metadata: Record<string, unknown> | null = null

  if (params.value !== undefined) {
    metadata = applyItemValueEdit(
      document.metadata,
      params.index,
      params.value
    )
  }

  if (params.attributes !== undefined) {
    metadata = applyItemAttributeEdit(
      metadata ?? document.metadata,
      params.index,
      params.attributes
    )
  }

  if (!metadata) {
    throw new ApiError(404, 'NOT_FOUND', 'That item no longer exists.')
  }

  return updateDocumentRecord(
    document.id,
    document.user_id,
    { metadata },
    params.requesterId
  )
}

export async function addDocumentExtractedItem(params: {
  documentId: string
  requesterId: string
  label: string
  value: number | null
  attributes?: ItemAttributes
}) {
  const document = await getEditableDocument(params.documentId, params.requesterId)
  const resolved = resolveItemValue({
    value: params.value,
    attributes: params.attributes,
  })

  if (resolved.value === null) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Provide a value or numeric price and quantity attributes.'
    )
  }

  const metadata = applyItemAppend(document.metadata, {
    label: params.label,
    value: resolved.value,
    attributes: resolved.attributes,
  })

  return updateDocumentRecord(
    document.id,
    document.user_id,
    { metadata },
    params.requesterId
  )
}

export async function updateDocumentCurrency(params: {
  documentId: string
  requesterId: string
  currency: 'NZD' | 'AUD'
}) {
  const document = await getEditableDocument(params.documentId, params.requesterId)
  const metadata =
    document.metadata &&
    typeof document.metadata === 'object' &&
    !Array.isArray(document.metadata)
      ? (document.metadata as Record<string, unknown>)
      : {}

  return updateDocumentRecord(
    document.id,
    document.user_id,
    { metadata: { ...metadata, itemCurrency: params.currency } },
    params.requesterId
  )
}

export async function downloadDocumentFile(storagePath: string) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_STORAGE_BUCKET)
    .download(storagePath)

  if (error || !data) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to download the uploaded document.'
    )
  }

  return new Uint8Array(await data.arrayBuffer())
}

export async function createDocumentPreviewUrl(
  documentId: string,
  requesterId: string,
  expiresInSeconds = 300
) {
  const document = await getAccessibleDocumentById(documentId, requesterId)

  if (document.file_type !== 'pdf' && document.file_type !== 'image') {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'Signed preview URLs are available only for PDF and image documents.'
    )
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_STORAGE_BUCKET)
    .createSignedUrl(document.storage_path, expiresInSeconds)

  if (error || !data?.signedUrl) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to create the document preview URL.',
      error?.message
    )
  }

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  }
}

export async function replaceDocumentChunks(
  documentId: string,
  userId: string,
  chunks: DocumentChunkInsert[]
) {
  const supabase = createAdminSupabaseClient()
  const { error: deleteError } = await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId)
    .eq('user_id', userId)

  if (deleteError) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to clear existing document chunks.'
    )
  }

  if (chunks.length === 0) {
    return [] as DocumentChunk[]
  }

  const { data, error } = await supabase
    .from('document_chunks')
    .insert(chunks)
    .select(
      'id, document_id, user_id, chunk_index, content, source_page, metadata, embedding, created_at'
    )

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to save document chunks.'
    )
  }

  return (data ?? []) as DocumentChunk[]
}

export async function listUserEmbeddedDocumentChunks(userId: string) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('document_chunks')
    .select(
      `
        id,
        document_id,
        user_id,
        chunk_index,
        content,
        source_page,
        metadata,
        embedding,
        created_at,
        documents!inner(file_name, file_type, financial_review_status)
      `
    )
    .eq('user_id', userId)
    .not('embedding', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load document chunks for retrieval.'
    )
  }

  return ((data ?? []) as unknown as Array<
    Omit<DocumentChunk, 'embedding'> & {
      embedding: number[]
      documents:
        | {
            file_name: string
            file_type: Document['file_type']
            financial_review_status: Document['financial_review_status']
          }
        | Array<{
            file_name: string
            file_type: Document['file_type']
            financial_review_status: Document['financial_review_status']
          }>
    }
  >).flatMap((row) => {
    const document = Array.isArray(row.documents)
      ? row.documents[0]
      : row.documents

    if (!document) {
      return []
    }

    return [
      {
        ...row,
        documents: document,
      },
    ]
  })
}
