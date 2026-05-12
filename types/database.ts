export interface User {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  created_at: string
  updated_at: string
}

export interface FinancialSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  cash_balance: number
  accounts_receivable: number
  accounts_payable: number
  monthly_revenue: number
  monthly_expenses: number
  burn_rate: number | null
  runway_months: number | null
  data_source: 'xero' | 'manual'
  raw_data: unknown
  created_at: string
}

export interface PolicyRule {
  id: string
  user_id: string
  rule_name: string
  rule_type: 'threshold' | 'approval' | 'compliance'
  rule_description: string | null
  rule_config: unknown
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  citations: unknown
  created_at: string
}

export interface Document {
  id: string
  user_id: string
  conversation_id: string | null
  file_name: string
  file_type: 'pdf' | 'csv'
  mime_type: string
  storage_path: string
  status: 'uploaded' | 'processing' | 'ready' | 'failed'
  document_type: string | null
  raw_text: string | null
  metadata: unknown
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  user_id: string
  chunk_index: number
  content: string
  source_page: number | null
  metadata: unknown
  embedding: number[] | null
  created_at: string
}

export interface XeroConnection {
  id: string
  user_id: string
  tenant_id: string
  tenant_name: string
  access_token_enc: string
  refresh_token_enc: string
  expires_at: string
  connected_at: string
  updated_at: string
}

export interface XeroOAuthState {
  id: string
  user_id: string
  state: string
  created_at: string
}

export interface DecisionLog {
  id: string
  user_id: string
  conversation_id: string | null
  assistant_message_id: string | null
  event_type:
    | 'chat_completion'
    | 'document_ingestion'
    | 'retrieval'
    | 'tool_call'
    | 'calculation'
  user_query: string
  ai_response: string
  conversation_history: unknown
  tools_used: unknown
  data_accessed: unknown
  calculations: unknown
  model_used: string | null
  tokens_used: number | null
  response_time_ms: number | null
  created_at: string
}
