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
