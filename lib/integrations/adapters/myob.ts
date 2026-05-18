import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '../types'

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

// Searches MYOB report sections for a matching DisplayID or Type
function findSectionTotal(sections: unknown[], name: string): number {
  for (const section of sections) {
    const s = section as Record<string, unknown>
    if (s.DisplayID === name || s.Type === name) {
      return parseFloat(String(s.Total ?? s.Amount ?? '0')) || 0
    }
  }
  return 0
}

export class MyobAdapter implements AccountingAdapter {
  readonly provider = 'myob' as const

  getAuthUrl(state: string): string {
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

    const tokenRes = await fetch(MYOB_TOKEN_URL, {
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

    if (!tokenRes.ok) throw new Error(`MYOB token exchange failed: ${tokenRes.status}`)
    const token = (await tokenRes.json()) as {
      access_token: string
      refresh_token: string
      expires_in?: number
    }

    // List company files — the file URI is used as tenantId for all subsequent API calls
    const filesRes = await fetch(MYOB_COMPANY_FILES_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!filesRes.ok) throw new Error(`MYOB company files fetch failed: ${filesRes.status}`)
    const files = (await filesRes.json()) as Array<{ Uri: string; Name: string }>
    if (!files.length) throw new Error('No MYOB company files found')

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      // MYOB access tokens expire in 30 minutes if not specified
      expiresAt: new Date(Date.now() + (token.expires_in ?? 1800) * 1000),
      tenantId: files[0].Uri,
      tenantName: files[0].Name,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()

    const res = await fetch(MYOB_TOKEN_URL, {
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

    if (!res.ok) throw new Error(`MYOB token refresh failed: ${res.status}`)
    const token = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in?: number
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (token.expires_in ?? 1800) * 1000),
      // tenantId/tenantName not returned on refresh — getValidTokens will preserve existing values
      tenantId: '',
      tenantName: '',
    }
  }

  async getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData> {
    const today = new Date()
    const dateFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const dateTo = today.toISOString().slice(0, 10)

    // MYOB uses the full company file URI as the API base URL
    const base = tokens.tenantId
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
    }

    const [bsRes, plRes] = await Promise.all([
      fetch(`${base}/GeneralLedger/BalanceSheet?DateFrom=${dateFrom}&DateTo=${dateTo}`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
      fetch(`${base}/GeneralLedger/ProfitLoss?DateFrom=${dateFrom}&DateTo=${dateTo}`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
    ])

    const [bsData, plData] = await Promise.all([
      bsRes.ok ? bsRes.json() : {},
      plRes.ok ? plRes.json() : {},
    ])

    const bsSections =
      ((bsData as Record<string, unknown>).BalanceSheet as Record<string, unknown> | undefined)
        ?.Sections ?? []
    const plSections =
      ((plData as Record<string, unknown>).ProfitLoss as Record<string, unknown> | undefined)
        ?.Sections ?? []

    return {
      cashBalance: findSectionTotal(bsSections as unknown[], 'Cash'),
      accountsReceivable: findSectionTotal(bsSections as unknown[], 'AccountsReceivable'),
      accountsPayable: findSectionTotal(bsSections as unknown[], 'AccountsPayable'),
      monthlyRevenue: findSectionTotal(plSections as unknown[], 'Income'),
      monthlyExpenses: findSectionTotal(plSections as unknown[], 'Expense'),
      currency: 'AUD',
      asOf: dateTo,
      raw: { balanceSheet: bsData, profitAndLoss: plData },
    }
  }

  // MYOB has limited webhook support — no signature verification available
  verifyWebhookSignature(_rawBody: string, _headers: Record<string, string>): boolean {
    return true
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const p = payload as Record<string, unknown>
    return {
      provider: 'myob',
      eventType: String(p.Type ?? p.eventType ?? 'unknown'),
      tenantId: String(p.CompanyFileId ?? ''),
      resourceId: p.ResourceId ? String(p.ResourceId) : undefined,
      raw: payload,
    }
  }
}
