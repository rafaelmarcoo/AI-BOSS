import { ApiError } from '@/lib/api/errors'
import { ChatMessagePayload } from '@/lib/api/validation'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type {
  Conversation,
  ConversationMessage,
} from '@/types/database'

function createConversationTitle(message: string) {
  const trimmed = message.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed
}

export async function getOrCreateConversation(
  userId: string,
  conversationId: string | undefined,
  firstUserMessage: string
) {
  const supabase = createAdminSupabaseClient()

  if (conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_id, title, created_at, updated_at')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.')
    }

    return data as Conversation
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      title: createConversationTitle(firstUserMessage),
    })
    .select('id, user_id, title, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to create conversation.')
  }

  return data as Conversation
}

export async function insertConversationMessage(params: {
  conversationId: string
  userId: string
  role: ChatMessagePayload['role']
  content: string
  citations?: unknown
}) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: params.conversationId,
      user_id: params.userId,
      role: params.role,
      content: params.content,
      citations: params.citations ?? null,
    })
    .select('id, conversation_id, user_id, role, content, citations, created_at')
    .single()

  if (error || !data) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save chat message.')
  }

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.conversationId)
    .eq('user_id', params.userId)

  return data as ConversationMessage
}

export async function listConversationMessages(
  conversationId: string,
  userId: string
) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, user_id, role, content, citations, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load conversation messages.'
    )
  }

  return (data ?? []) as ConversationMessage[]
}

export async function listUserConversations(userId: string) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load conversations.'
    )
  }

  return (data ?? []) as Conversation[]
}

export function mapConversationMessagesToPayload(
  messages: ConversationMessage[]
): ChatMessagePayload[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}
