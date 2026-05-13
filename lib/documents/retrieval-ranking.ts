import type { Document, DocumentChunk } from '@/types/database'

export interface RetrievedDocumentChunk {
  id: string
  documentId: string
  documentName: string
  documentType: Document['file_type']
  chunkIndex: number
  content: string
  sourcePage: number | null
  metadata: unknown
  similarity: number
}

export type EmbeddedDocumentChunk = Omit<DocumentChunk, 'embedding'> & {
  embedding: number[] | string | null
  documents: {
    file_name: string
    file_type: Document['file_type']
  }
}

export function normalizeEmbeddingVector(value: number[] | string | null) {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const withoutBrackets =
    trimmed.startsWith('[') && trimmed.endsWith(']')
      ? trimmed.slice(1, -1)
      : trimmed
  const vector = withoutBrackets
    .split(',')
    .map((part) => Number(part.trim()))

  if (vector.length === 0 || vector.some((part) => !Number.isFinite(part))) {
    return null
  }

  return vector
}

function dotProduct(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0)
}

function magnitude(vector: number[]) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
}

export function cosineSimilarity(a: number[], b: number[]) {
  const denominator = magnitude(a) * magnitude(b)

  if (denominator === 0) {
    return 0
  }

  return dotProduct(a, b) / denominator
}

export function rankDocumentChunksBySimilarity(params: {
  queryEmbedding: number[]
  chunks: EmbeddedDocumentChunk[]
  limit?: number
  minimumSimilarity?: number
}): RetrievedDocumentChunk[] {
  const limit = params.limit ?? 5
  const minimumSimilarity = params.minimumSimilarity ?? 0

  return params.chunks
    .flatMap((chunk) => {
      const embedding = normalizeEmbeddingVector(chunk.embedding)

      if (!embedding) {
        return []
      }

      const similarity = cosineSimilarity(params.queryEmbedding, embedding)

      if (similarity < minimumSimilarity) {
        return []
      }

      return [
        {
          id: chunk.id,
          documentId: chunk.document_id,
          documentName: chunk.documents.file_name,
          documentType: chunk.documents.file_type,
          chunkIndex: chunk.chunk_index,
          content: chunk.content,
          sourcePage: chunk.source_page,
          metadata: chunk.metadata,
          similarity,
        },
      ]
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}
