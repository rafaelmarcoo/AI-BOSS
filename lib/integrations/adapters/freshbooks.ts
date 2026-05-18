import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

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

function readAmount(value: unknown) {
  const total = (value as Record<string, unknown> | undefined)?.total as
    | Record<string, unknown>
    | undefined
  return parseFloat(String(total?.amount ?? '0')) || 0
}

export class FreshBooksAdapter implements AccountingAdapter {
  readonly provider = 'freshbooks' as const
  readonly label = 'FreshBooks'

  getAuthUrl(state: string) {
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
    const tokenResponse = await fetch(FB_TOKEN_URL, {
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

    if (!tokenResponse.ok) {
      throw new Error(`FreshBooks token exchange failed: ${tokenResponse.status}`)
    }
    const token = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const profileResponse = await fetch(`${FB_API_URL}/auth/api/v1/users/me`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!profileResponse.ok) throw new Error(`FreshBooks /me failed: ${profileResponse.status}`)
    const profile = (await profileResponse.json()) as Record<string, unknown>
    const response = profile.response as Record<string, unknown> | undefined
    const memberships = response?.business_memberships as
      | Array<{ business: { account_id: string; name: string } }>
      | undefined
    const business = memberships?.[0]?.business

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: String(business?.account_id ?? response?.id ?? 'unknown'),
      tenantName: business?.name ?? String(response?.email ?? 'FreshBooks'),
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()
    const response = await fetch(FB_TOKEN_URL, {
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

    if (!response.ok) throw new Error(`FreshBooks token refresh failed: ${response.status}`)
    const token = (await response.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: '',
      tenantName: '',
    }
  }

  async getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData> {
    const today = new Date()
    const dateFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const dateTo = today.toISOString().slice(0, 10)
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Api-Version': 'alpha',
    }

    const [balanceSheetResponse, profitLossResponse] = await Promise.all([
      fetch(
        `${FB_API_URL}/accounting/account/${tokens.tenantId}/reports/accounting/balancesheet?end_date=${dateTo}`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
      fetch(
        `${FB_API_URL}/accounting/account/${tokens.tenantId}/reports/accounting/profitloss?date_from=${dateFrom}&date_to=${dateTo}`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
    ])

    const [balanceSheet, profitLoss] = await Promise.all([
      balanceSheetResponse.ok ? balanceSheetResponse.json() : {},
      profitLossResponse.ok ? profitLossResponse.json() : {},
    ])
    const balanceReport = (
      ((balanceSheet as Record<string, unknown>).response as Record<string, unknown> | undefined)
        ?.result as Record<string, unknown> | undefined
    )?.balancesheet as Record<string, unknown> | undefined
    const profitLossReport = (
      ((profitLoss as Record<string, unknown>).response as Record<string, unknown> | undefined)
        ?.result as Record<string, unknown> | undefined
    )?.profitloss as Record<string, unknown> | undefined
    const currency = String(profitLossReport?.currency_code ?? balanceReport?.currency_code ?? 'USD')

    return {
      cashBalance: 0,
      accountsReceivable: readAmount(balanceReport?.accounts_receivable),
      accountsPayable: readAmount(balanceReport?.accounts_payable),
      monthlyRevenue: readAmount(profitLossReport?.total_income),
      monthlyExpenses: readAmount(profitLossReport?.total_expenses),
      currency,
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
      provider: 'freshbooks',
      eventType: String(record.name ?? 'unknown'),
      tenantId: String(record.accountid ?? ''),
      resourceId: record.object_id ? String(record.object_id) : undefined,
      raw: payload,
    }
  }
}
