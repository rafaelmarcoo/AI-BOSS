import { randomUUID } from 'crypto'
import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { DOCUMENTS_STORAGE_BUCKET } from '@/lib/documents/constants'
import type { Document, DocumentChunk, DocumentDeletionResult } from '@/types/database'
import type { DocumentChunkInsert, DocumentSummary } from '@/lib/documents/types'
import type { SupportedDocumentType } from '@/lib/documents/constants'

const DOCUMENT_SUMMARY_SELECT = `
  id,
  conversation_id,
  file_name,
  file_type,
  mime_type,
  storage_path,
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
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_SUMMARY_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load documents.')
  }

  return (data ?? []) as DocumentSummary[]
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
  const document = await getDocumentById(documentId, userId)

  await deleteDocumentFile(document.storage_path)

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc(
    'delete_owned_document_and_derived_metrics',
    {
      p_document_id: documentId,
      p_user_id: userId,
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
      conversation_id: params.conversationId,
      file_name: params.fileName,
      file_type: params.fileType,
      mime_type: params.mimeType,
      storage_path: params.storagePath,
      status: 'uploaded',
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

  return data as DocumentSummary
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

export async function updateDocumentRecord(
  documentId: string,
  userId: string,
  updates: Partial<
    Pick<Document, 'status' | 'raw_text' | 'metadata' | 'error_message'>
  >
) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .eq('user_id', userId)
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

  return data as DocumentSummary
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
        documents!inner(file_name, file_type)
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
          }
        | Array<{
            file_name: string
            file_type: Document['file_type']
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
