import { ApiError } from '@/lib/api/errors'
import { embedQuery } from '@/lib/documents/embeddings'
import { listUserEmbeddedDocumentChunks } from '@/lib/documents/persistence'
import { rankDocumentChunksBySimilarity } from '@/lib/documents/retrieval-ranking'
export type { RetrievedDocumentChunk } from '@/lib/documents/retrieval-ranking'

export async function retrieveRelevantDocumentChunks(params: {
  userId: string
  query: string
  limit?: number
  minimumSimilarity?: number
}) {
  const query = params.query.trim()

  if (!query) {
    throw new ApiError(400, 'BAD_REQUEST', 'Retrieval query cannot be empty.')
  }

  const [queryEmbedding, chunks] = await Promise.all([
    embedQuery(query),
    listUserEmbeddedDocumentChunks(params.userId),
  ])

  return rankDocumentChunksBySimilarity({
    queryEmbedding,
    chunks,
    limit: params.limit,
    minimumSimilarity: params.minimumSimilarity,
  })
}
