import type { AccountingProvider } from '@/types/database'

export type { AccountingProvider }

export interface ProviderStatus {
  provider: AccountingProvider
  status: 'connected' | 'disconnected' | 'available' | 'error'
  displayName: string | null
  connectedAt: string | null
  lastSyncedAt: string | null
}

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  tenantId: string
  tenantName: string
}

export interface NormalizedFinancialData {
  cashBalance: number
  accountsReceivable: number
  accountsPayable: number
  monthlyRevenue: number
  monthlyExpenses: number
  currency: string
  asOf: string
  raw: unknown
  detailed?: NormalizedAccountingDataset
}

export interface NormalizedAccountRecord {
  providerAccountId: string
  code?: string | null
  name: string
  accountClass: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'other'
  subtype?: string | null
  canonicalCategory?: string | null
  costBehavior?: 'fixed' | 'variable' | 'mixed' | 'unclassified'
  currency?: string | null
  isActive?: boolean
  raw?: unknown
}

export interface NormalizedStatementLineRecord {
  lineKey: string
  label: string
  classification:
    | 'revenue'
    | 'cost_of_sales'
    | 'operating_expense'
    | 'other_income'
    | 'other_expense'
    | 'gross_profit'
    | 'operating_profit'
    | 'net_profit'
    | 'cash_inflow'
    | 'cash_outflow'
    | 'net_cash_flow'
    | 'other'
  amount: number
  providerAccountId?: string | null
  canonicalCategory?: string | null
  costBehavior?: 'fixed' | 'variable' | 'mixed' | 'unclassified'
  isTotal?: boolean
  sortOrder?: number
  raw?: unknown
}

export interface NormalizedReportingPeriodRecord {
  statementType: 'profit_loss' | 'cash_flow'
  periodStart: string
  periodEnd: string
  currency: string
  generatedAt?: string | null
  lines: NormalizedStatementLineRecord[]
  raw?: unknown
}

export interface NormalizedTransactionLineRecord {
  lineKey: string
  providerAccountId?: string | null
  description?: string | null
  canonicalCategory?: string | null
  amount: number
  taxAmount?: number
  raw?: unknown
}

export interface NormalizedTransactionRecord {
  providerTransactionId: string
  transactionType: 'receipt' | 'payment' | 'purchase' | 'sale' | 'transfer' | 'journal' | 'other'
  transactionDate: string
  status: 'draft' | 'posted' | 'voided' | 'deleted'
  direction: 'inflow' | 'outflow' | 'transfer'
  reference?: string | null
  counterpartyName?: string | null
  description?: string | null
  currency: string
  totalAmount: number
  lines: NormalizedTransactionLineRecord[]
  raw?: unknown
}

export interface NormalizedBudgetLineRecord {
  lineKey: string
  providerAccountId?: string | null
  label: string
  kind: 'revenue' | 'expense' | 'cash_inflow' | 'cash_outflow'
  canonicalCategory?: string | null
  periodStart: string
  periodEnd: string
  amount: number
  raw?: unknown
}

export interface NormalizedBudgetRecord {
  providerBudgetId: string
  name: string
  status: 'draft' | 'approved' | 'archived'
  periodStart: string
  periodEnd: string
  currency: string
  lines: NormalizedBudgetLineRecord[]
  raw?: unknown
}

export interface NormalizedAccountingDataset {
  capabilities: string[]
  accounts: NormalizedAccountRecord[]
  reportingPeriods: NormalizedReportingPeriodRecord[]
  transactions: NormalizedTransactionRecord[]
  budgets: NormalizedBudgetRecord[]
}

export interface WebhookEvent {
  provider: AccountingProvider
  eventType: string
  tenantId: string
  resourceId?: string
  raw: unknown
}

export interface AccountingAdapter {
  readonly provider: AccountingProvider
  readonly label: string
  getAuthUrl(state: string): string
  exchangeCodeForTokens(
    code: string,
    state: string,
    extra?: Record<string, string>
  ): Promise<OAuthTokens>
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>
  getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData>
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean
  parseWebhookEvent(payload: unknown): WebhookEvent
}
