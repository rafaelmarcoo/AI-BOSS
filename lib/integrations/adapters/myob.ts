import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

const MYOB_AUTH_URL = 'https://secure.myob.com/oauth2/account/authorize'
const MYOB_TOKEN_URL = 'https://secure.myob.com/oauth2/v1/authorize'
const MYOB_COMPANY_FILES_URL = 'https://api.myob.com/accountright'

function getCredentials() {
  const clientId = process.env.MYOB_CLIENT_ID
  const clientSecret = process.env.MYOB_CLIENT_SECRET
  const redirectUri = process.env.MYOB_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing MYOB_CLIENT_ID, MYOB_CLIENT_SECRET, or MYOB_REDIRECT_URI')
  }

  return { clientId, clientSecret, redirectUri }
}

function findSectionTotal(sections: unknown[], name: string) {
  for (const section of sections) {
    const record = section as Record<string, unknown>
    if (record.DisplayID === name || record.Type === name) {
      return parseFloat(String(record.Total ?? record.Amount ?? '0')) || 0
    }
  }

  return 0
}

export class MyobAdapter implements AccountingAdapter {
  readonly provider = 'myob' as const
  readonly label = 'MYOB'

  getAuthUrl(state: string) {
    const { clientId, redirectUri } = getCredentials()
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'la.global',
      state,
    })

    return `${MYOB_AUTH_URL}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()
    const tokenResponse = await fetch(MYOB_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) throw new Error(`MYOB token exchange failed: ${tokenResponse.status}`)
    const token = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in?: number
    }

    const filesResponse = await fetch(MYOB_COMPANY_FILES_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!filesResponse.ok) throw new Error(`MYOB company files fetch failed: ${filesResponse.status}`)
    const files = (await filesResponse.json()) as Array<{ Uri: string; Name: string }>
    const file = files[0]
    if (!file) throw new Error('No MYOB company files found')

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + (token.expires_in ?? 1800) * 1000),
      tenantId: file.Uri,
      tenantName: file.Name,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()
    const response = await fetch(MYOB_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) throw new Error(`MYOB token refresh failed: ${response.status}`)
    const token = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (token.expires_in ?? 1800) * 1000),
      tenantId: '',
      tenantName: '',
    }
  }

  async getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData> {
    const today = new Date()
    const dateFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const dateTo = today.toISOString().slice(0, 10)
    const headers = { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'application/json' }

    const [balanceSheetResponse, profitLossResponse] = await Promise.all([
      fetch(`${tokens.tenantId}/GeneralLedger/BalanceSheet?DateFrom=${dateFrom}&DateTo=${dateTo}`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
      fetch(`${tokens.tenantId}/GeneralLedger/ProfitLoss?DateFrom=${dateFrom}&DateTo=${dateTo}`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
    ])

    const [balanceSheet, profitLoss] = await Promise.all([
      balanceSheetResponse.ok ? balanceSheetResponse.json() : {},
      profitLossResponse.ok ? profitLossResponse.json() : {},
    ])
    const balanceSections =
      ((balanceSheet as Record<string, unknown>).BalanceSheet as Record<string, unknown> | undefined)
        ?.Sections ?? []
    const profitLossSections =
      ((profitLoss as Record<string, unknown>).ProfitLoss as Record<string, unknown> | undefined)
        ?.Sections ?? []

    return {
      cashBalance: findSectionTotal(balanceSections as unknown[], 'Cash'),
      accountsReceivable: findSectionTotal(balanceSections as unknown[], 'AccountsReceivable'),
      accountsPayable: findSectionTotal(balanceSections as unknown[], 'AccountsPayable'),
      monthlyRevenue: findSectionTotal(profitLossSections as unknown[], 'Income'),
      monthlyExpenses: findSectionTotal(profitLossSections as unknown[], 'Expense'),
      currency: 'AUD',
      asOf: dateTo,
      raw: { balanceSheet, profitLoss },
    }
  }

  verifyWebhookSignature() {
    return false
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const record = payload as Record<string, unknown>
    return {
      provider: 'myob',
      eventType: String(record.Type ?? record.eventType ?? 'unknown'),
      tenantId: String(record.CompanyFileId ?? ''),
      resourceId: record.ResourceId ? String(record.ResourceId) : undefined,
      raw: payload,
    }
  }
}
