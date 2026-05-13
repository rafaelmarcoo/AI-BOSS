import { OpenAIEmbeddings } from '@langchain/openai'
import { ApiError } from '@/lib/api/errors'
import type { DocumentChunkInsert } from '@/lib/documents/types'

export const DOCUMENT_EMBEDDING_MODEL = 'text-embedding-3-small'

function createDocumentEmbeddingModel() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  return new OpenAIEmbeddings({
    apiKey,
    model: DOCUMENT_EMBEDDING_MODEL,
  })
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) {
    return []
  }

  const embeddings = createDocumentEmbeddingModel()
  return embeddings.embedDocuments(texts)
}

export async function embedQuery(text: string) {
  const embeddings = createDocumentEmbeddingModel()
  return embeddings.embedQuery(text)
}

export async function embedDocumentChunks(chunks: DocumentChunkInsert[]) {
  const vectors = await embedTexts(chunks.map((chunk) => chunk.content))

  return chunks.map((chunk, index) => ({
    ...chunk,
    embedding: vectors[index] ?? null,
  }))
}
