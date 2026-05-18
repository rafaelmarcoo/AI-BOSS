import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '../types'

const FB_AUTH_URL = 'https://auth.freshbooks.com/oauth/authorize'
const FB_TOKEN_URL = 'https://api.freshbooks.com/auth/oauth/token'
const FB_API_URL = 'https://api.freshbooks.com'

function getCredentials() {
  const clientId = process.env.FRESHBOOKS_CLIENT_ID
  const clientSecret = process.env.FRESHBOOKS_CLIENT_SECRET
  const redirectUri = process.env.FRESHBOOKS_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing FRESHBOOKS_CLIENT_ID, FRESHBOOKS_CLIENT_SECRET, or FRESHBOOKS_REDIRECT_URI'
    )
  }
  return { clientId, clientSecret, redirectUri }
}

export class FreshBooksAdapter implements AccountingAdapter {
  readonly provider = 'freshbooks' as const

  getAuthUrl(state: string): string {
    const { clientId, redirectUri } = getCredentials()
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    })
    return `${FB_AUTH_URL}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()

    const tokenRes = await fetch(FB_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) throw new Error(`FreshBooks token exchange failed: ${tokenRes.status}`)
    const token = (await tokenRes.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    // Fetch user profile to get accountId and business name
    const meRes = await fetch(`${FB_API_URL}/auth/api/v1/users/me`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!meRes.ok) throw new Error(`FreshBooks /me failed: ${meRes.status}`)
    const me = (await meRes.json()) as Record<string, unknown>
    const response = me.response as Record<string, unknown> | undefined
    const memberships = response?.business_memberships as
      | Array<{ business: { account_id: string; name: string } }>
      | undefined
    const business = memberships?.[0]?.business
    const tenantId = String(business?.account_id ?? response?.id ?? 'unknown')
    const tenantName = business?.name ?? String(response?.email ?? 'FreshBooks')

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId,
      tenantName,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()

    const res = await fetch(FB_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) throw new Error(`FreshBooks token refresh failed: ${res.status}`)
    const token = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      // tenantId/tenantName not returned on refresh — getValidTokens will preserve existing values
      tenantId: '',
      tenantName: '',
    }
  }

  async getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData> {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const dateFrom = `${year}-${month}-01`
    const dateTo = today.toISOString().slice(0, 10)
    const accountId = tokens.tenantId
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Api-Version': 'alpha',
    }

    const [bsRes, plRes] = await Promise.all([
      fetch(
        `${FB_API_URL}/accounting/account/${accountId}/reports/accounting/balancesheet?end_date=${dateTo}`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
      fetch(
        `${FB_API_URL}/accounting/account/${accountId}/reports/accounting/profitloss?date_from=${dateFrom}&date_to=${dateTo}`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
    ])

    const [bsData, plData] = await Promise.all([
      bsRes.ok ? bsRes.json() : {},
      plRes.ok ? plRes.json() : {},
    ])

    // FreshBooks response shape: { response: { result: { profitloss: { ... } } } }
    const bsReport = (
      ((bsData as Record<string, unknown>).response as Record<string, unknown> | undefined)
        ?.result as Record<string, unknown> | undefined
    )?.balancesheet as Record<string, unknown> | undefined

    const plReport = (
      ((plData as Record<string, unknown>).response as Record<string, unknown> | undefined)
        ?.result as Record<string, unknown> | undefined
    )?.profitloss as Record<string, unknown> | undefined

    // Extracts the numeric amount from FreshBooks total objects: { amount: "1234.56", code: "NZD" }
    const getAmount = (obj: unknown): number => {
      const total = (obj as Record<string, unknown> | undefined)?.total as
        | Record<string, unknown>
        | undefined
      return parseFloat(String(total?.amount ?? '0')) || 0
    }

    const currency = String(plReport?.currency_code ?? bsReport?.currency_code ?? 'USD')

    return {
      // FreshBooks requires Plaid bank sync for cash — not available via API alone
      cashBalance: 0,
      accountsReceivable: getAmount(bsReport?.accounts_receivable),
      accountsPayable: getAmount(bsReport?.accounts_payable),
      monthlyRevenue: getAmount(plReport?.total_income),
      monthlyExpenses: getAmount(plReport?.total_expenses),
      currency,
      asOf: dateTo,
      raw: { balanceSheet: bsData, profitAndLoss: plData },
    }
  }
  // FreshBooks does not sign webhook payloads, so all received webhooks are accepted.
  verifyWebhookSignature(_rawBody: string, _headers: Record<string, string>): boolean {
    return true
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const p = payload as Record<string, unknown>
    return {
      provider: 'freshbooks',
      eventType: String(p.name ?? 'unknown'),
      tenantId: String(p.accountid ?? ''),
      resourceId: p.object_id ? String(p.object_id) : undefined,
      raw: payload,
    }
  }
}
