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

export interface DecisionLog {
  id: string
  user_id: string
  user_query: string
  ai_response: string
  tools_used: unknown
  data_accessed: unknown
  calculations: unknown
  model_used: string | null
  tokens_used: number | null
  response_time_ms: number | null
  created_at: string
}
