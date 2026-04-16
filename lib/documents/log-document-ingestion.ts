import { createAdminSupabaseClient } from '@/lib/supabase'
import { ApiError } from '@/lib/api/errors'

interface LogDocumentIngestionParams {
  userId: string
  documentId: string
  conversationId: string | null
  fileName: string
  status: 'ready' | 'failed'
  chunkCount: number
  metadata: unknown
  errorMessage: string | null
  responseTimeMs: number
}

export async function logDocumentIngestion({
  userId,
  documentId,
  conversationId,
  fileName,
  status,
  chunkCount,
  metadata,
  errorMessage,
  responseTimeMs,
}: LogDocumentIngestionParams) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('decision_log').insert({
    user_id: userId,
    conversation_id: conversationId,
    assistant_message_id: null,
    event_type: 'document_ingestion',
    user_query: `Process document: ${fileName}`,
    ai_response:
      status === 'ready'
        ? `Processed ${fileName} into ${chunkCount} chunks.`
        : `Failed to process ${fileName}.`,
    conversation_history: null,
    tools_used: [],
    data_accessed: {
      documentId,
      chunkCount,
      metadata,
      ...(errorMessage ? { errorMessage } : {}),
    },
    calculations: null,
    model_used: null,
    tokens_used: null,
    response_time_ms: responseTimeMs,
  })

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to log document ingestion.'
    )
  }
}
