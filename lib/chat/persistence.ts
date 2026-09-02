import { ApiError } from '@/lib/api/errors'
import { ChatMessagePayload } from '@/lib/api/validation'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type {
  Conversation,
  ConversationMessage,
  ConversationVisibility,
} from '@/types/database'
import { createConversationTitle } from '@/lib/chat/conversation-title'
import { parseGenUiPlan } from '@/lib/gen-ui/schema'
import type { GenUiPlan } from '@/lib/gen-ui/types'
import { getUserCompany } from '@/lib/companies'

const CONVERSATION_COLUMNS =
  'id, user_id, company_id, visibility, title, created_at, updated_at'

export interface ConversationPayloadMessage extends ChatMessagePayload {
  ui: GenUiPlan | null
}

export async function getOrCreateConversation(
  userId: string,
  conversationId: string | undefined,
  firstUserMessage: string,
  visibility: ConversationVisibility = 'company'
) {
  const supabase = createAdminSupabaseClient()
  const company = await getUserCompany(userId)

  if (visibility === 'admins' && company.userType !== 'admin') {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Only company admins can create an admins-only conversation.'
    )
  }

  if (conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_COLUMNS)
      .eq('id', conversationId)
      .eq('user_id', userId)
      .eq('company_id', company.id)
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
      company_id: company.id,
      visibility,
      title: createConversationTitle(firstUserMessage),
    })
    .select(CONVERSATION_COLUMNS)
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
  uiPayload?: GenUiPlan | null
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
      ui_payload: params.uiPayload ?? null,
    })
    .select(
      'id, conversation_id, user_id, role, content, citations, ui_payload, created_at'
    )
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

/**
 * Saves one completed user/assistant turn with a single database INSERT.
 * PostgreSQL treats the multi-row statement atomically, so a failed model call
 * never leaves an orphaned user message that will be duplicated on retry.
 */
export async function insertConversationTurn(params: {
  conversationId: string
  userId: string
  userContent: string
  assistantContent: string
  assistantUiPayload?: GenUiPlan | null
}) {
  const supabase = createAdminSupabaseClient()
  const userCreatedAt = new Date()
  const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1)
  const { data, error } = await supabase
    .from('conversation_messages')
    .insert([
      {
        conversation_id: params.conversationId,
        user_id: params.userId,
        role: 'user',
        content: params.userContent,
        citations: null,
        ui_payload: null,
        created_at: userCreatedAt.toISOString(),
      },
      {
        conversation_id: params.conversationId,
        user_id: params.userId,
        role: 'assistant',
        content: params.assistantContent,
        citations: null,
        ui_payload: params.assistantUiPayload ?? null,
        created_at: assistantCreatedAt.toISOString(),
      },
    ])
    .select(
      'id, conversation_id, user_id, role, content, citations, ui_payload, created_at'
    )

  const messages = (data ?? []) as ConversationMessage[]
  const userMessage = messages.find((message) => message.role === 'user')
  const assistantMessage = messages.find((message) => message.role === 'assistant')

  if (error || !userMessage || !assistantMessage) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save completed chat turn.')
  }

  await supabase
    .from('conversations')
    .update({ updated_at: assistantCreatedAt.toISOString() })
    .eq('id', params.conversationId)
    .eq('user_id', params.userId)

  return { userMessage, assistantMessage }
}

export async function listConversationMessages(
  conversationId: string,
  userId: string
) {
  const supabase = createAdminSupabaseClient()
  await getCompanyConversation(conversationId, userId)
  const { data, error } = await supabase
    .from('conversation_messages')
    .select(
      'id, conversation_id, user_id, role, content, citations, ui_payload, created_at'
    )
    .eq('conversation_id', conversationId)
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
  const company = await getUserCompany(userId)
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('company_id', company.id)
    .or(
      company.userType === 'admin'
        ? `user_id.eq.${userId},visibility.in.(company,admins)`
        : `user_id.eq.${userId},visibility.eq.company`
    )
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

export async function getCompanyConversation(
  conversationId: string,
  userId: string
) {
  const supabase = createAdminSupabaseClient()
  const company = await getUserCompany(userId)
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('id', conversationId)
    .eq('company_id', company.id)
    .or(
      company.userType === 'admin'
        ? `user_id.eq.${userId},visibility.in.(company,admins)`
        : `user_id.eq.${userId},visibility.eq.company`
    )
    .single()

  if (error || !data) {
    throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.')
  }

  return data as Conversation
}

export async function renameConversation(
  conversationId: string,
  userId: string,
  title: string | null
) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('conversations')
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('user_id', userId)
    .select(CONVERSATION_COLUMNS)
    .single()

  if (error || !data) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to rename conversation.')
  }

  return data as Conversation
}

export async function updateConversationVisibility(
  conversationId: string,
  userId: string,
  visibility: ConversationVisibility
) {
  const supabase = createAdminSupabaseClient()
  const company = await getUserCompany(userId)

  if (visibility === 'admins' && company.userType !== 'admin') {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Only company admins can use admins-only visibility.'
    )
  }

  const { data, error } = await supabase
    .from('conversations')
    .update({
      visibility,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('user_id', userId)
    .eq('company_id', company.id)
    .select(CONVERSATION_COLUMNS)
    .single()

  if (error || !data) {
    throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.')
  }

  return data as Conversation
}

export async function deleteConversation(
  conversationId: string,
  userId: string
) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId)

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to delete conversation.')
  }
}

export function mapConversationMessagesToPayload(
  messages: ConversationMessage[]
): ConversationPayloadMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    ui: parseGenUiPlan(message.ui_payload),
  }))
}
