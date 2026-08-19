import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { FinancialMetricSourceType } from '@/lib/financial-data/types'
import type { GenUiPlan } from '@/lib/gen-ui/types'
import type { ScenarioAnalysisInput } from '@/lib/scenarios/schema'
import type { ScenarioAnalysisResult } from '@/lib/scenarios/calculation'

export type UserType = 'admin' | 'employee'
export type ConversationVisibility = 'private' | 'company' | 'admins'
export type ScenarioVisibility = 'private' | 'company'
export type ScenarioStatus = 'draft' | 'calculated'

export interface User {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  user_type: UserType | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  created_by: string | null
  created_at: string
  updated_at: string
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
  company_id: string
  visibility: ConversationVisibility
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
  ui_payload: GenUiPlan | null
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

/** Result returned by the server-only document cleanup database function. */
export interface DocumentDeletionResult {
  deleted: boolean
}

export type AccountingProvider = 'xero' | 'quickbooks' | 'freshbooks' | 'myob'
export type DataConnectionProvider =
  | AccountingProvider
  | 'csv'
  | 'pdf'
  | 'manual'
  | 'demo'
export type DataConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'available'
  | 'error'

export interface DataConnection {
  id: string
  user_id: string
  provider: DataConnectionProvider
  status: DataConnectionStatus
  display_name: string
  source_label: string
  last_synced_at: string | null
  connected_at: string | null
  disconnected_at: string | null
  error_message: string | null
  metadata: unknown
  created_at: string
  updated_at: string
}

export interface OAuthConnectionState {
  id: string
  user_id: string
  provider: DataConnectionProvider
  state: string
  redirect_path: string
  created_at: string
}

export interface OAuthToken {
  id: string
  connection_id: string
  user_id: string
  provider: AccountingProvider
  tenant_id: string
  tenant_name: string
  access_token_enc: string
  refresh_token_enc: string
  expires_at: string
  connected_at: string
  updated_at: string
}

export interface FinancialMetricObservation {
  id: string
  user_id: string
  connection_id: string | null
  document_id: string | null
  metric_key: FinancialMetricKey
  value: number
  currency: string | null
  period_start: string | null
  period_end: string | null
  as_of_date: string | null
  source_type: FinancialMetricSourceType
  source_label: string
  confidence: number
  evidence: unknown
  raw_data: unknown
  created_at: string
  updated_at: string
}

export interface SavedScenario {
  id: string
  user_id: string
  company_id: string
  name: string
  description: string | null
  status: ScenarioStatus
  visibility: ScenarioVisibility
  input_payload: ScenarioAnalysisInput | Record<string, unknown>
  result_payload: ScenarioAnalysisResult | null
  baseline_fingerprint: Array<{ id: string; updatedAt: string }>
  calculated_at: string | null
  created_at: string
  updated_at: string
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
