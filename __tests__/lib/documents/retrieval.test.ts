import {
  cosineSimilarity,
  normalizeEmbeddingVector,
  rankDocumentChunksBySimilarity,
} from '@/lib/documents/retrieval-ranking'

describe('document retrieval ranking', () => {
  it('calculates cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0)
  })

  it('normalizes pgvector string embeddings returned by Supabase', () => {
    expect(normalizeEmbeddingVector('[0.1,0.2,0.3]')).toEqual([
      0.1,
      0.2,
      0.3,
    ])
    expect(normalizeEmbeddingVector('0.1, 0.2')).toEqual([0.1, 0.2])
    expect(normalizeEmbeddingVector('not-a-vector')).toBeNull()
  })

  it('ranks embedded chunks by similarity and keeps source metadata', () => {
    const chunks = [
      {
        id: 'chunk-low',
        document_id: 'document-1',
        user_id: 'user-1',
        chunk_index: 0,
        content: 'General company policy',
        source_page: 2,
        metadata: { page: 2 },
        embedding: [0, 1],
        created_at: '2026-05-12T00:00:00.000Z',
        documents: {
          file_name: 'policy.pdf',
          file_type: 'pdf' as const,
        },
      },
      {
        id: 'chunk-high',
        document_id: 'document-2',
        user_id: 'user-1',
        chunk_index: 3,
        content: 'Cash runway is 5.4 months',
        source_page: null,
        metadata: { rowStart: 7, rowEnd: 7 },
        embedding: '[1,0]',
        created_at: '2026-05-12T00:00:00.000Z',
        documents: {
          file_name: 'summary.csv',
          file_type: 'csv' as const,
        },
      },
    ]

    expect(
      rankDocumentChunksBySimilarity({
        queryEmbedding: [1, 0],
        chunks,
        limit: 1,
      })
    ).toEqual([
      {
        id: 'chunk-high',
        documentId: 'document-2',
        documentName: 'summary.csv',
        documentType: 'csv',
        chunkIndex: 3,
        content: 'Cash runway is 5.4 months',
        sourcePage: null,
        metadata: { rowStart: 7, rowEnd: 7 },
        similarity: 1,
      },
    ])
  })
})
