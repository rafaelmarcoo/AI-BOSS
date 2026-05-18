export type AccountingProvider = 'xero' | 'quickbooks' | 'freshbooks' | 'myob'

export interface ProviderStatus {
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
