import { randomUUID } from 'crypto'
import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { DOCUMENTS_STORAGE_BUCKET } from '@/lib/documents/constants'
import type { Document, DocumentChunk } from '@/types/database'
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
  const supabase = createAdminSupabaseClient()
  const storagePath = createStoragePath(params.userId, params.file.name)
  const { error } = await supabase.storage
    .from(DOCUMENTS_STORAGE_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type || undefined,
      upsert: false,
    })

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to upload document file.')
  }

  return {
    storagePath,
  }
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
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to create document.')
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
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to update document.')
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
