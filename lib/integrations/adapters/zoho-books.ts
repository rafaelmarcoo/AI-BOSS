import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'
const ZOHO_BOOKS_SCOPE = 'ZohoBooks.fullaccess.all'

// Zoho accounts live in one of several regional data centers. The authorize
// step always starts at the global accounts.zoho.com entry point, which
// redirects the user to their actual DC — that DC is then reported back on
// the callback as `accounts-server` (a full URL) or `location` (a short
// code), and every request from here on (token exchange, refresh) must go to
// that same regional domain instead of the global one.
const LOCATION_TO_ACCOUNTS_DOMAIN: Record<string, string> = {
  us: 'https://accounts.zoho.com',
  eu: 'https://accounts.zoho.eu',
  in: 'https://accounts.zoho.in',
  au: 'https://accounts.zoho.com.au',
  jp: 'https://accounts.zoho.jp',
  ca: 'https://accounts.zohocloud.ca',
  sa: 'https://accounts.zoho.sa',
  uk: 'https://accounts.zoho.uk',
  cn: 'https://accounts.zoho.com.cn',
}

function getCredentials() {
  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const redirectUri = process.env.ZOHO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REDIRECT_URI')
  }

  return { clientId, clientSecret, redirectUri }
}

function resolveAccountsDomain(extra?: Record<string, string>) {
  const accountsServer = extra?.['accounts-server']
  if (accountsServer) return accountsServer

  const location = extra?.location?.toLowerCase()
  if (location && LOCATION_TO_ACCOUNTS_DOMAIN[location]) {
    return LOCATION_TO_ACCOUNTS_DOMAIN[location]
  }

  return ZOHO_ACCOUNTS_URL
}

// Zoho's report responses nest line items several levels deep under varying
// keys depending on report type, so rather than hard-code an exact shape,
// this walks the whole tree looking for a line item whose name matches.
function findReportTotal(node: unknown, matchNames: string[]): number {
  if (!node || typeof node !== 'object') return 0

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findReportTotal(item, matchNames)
      if (found) return found
    }
    return 0
  }

  const record = node as Record<string, unknown>
  const name = String(record.name ?? record.account_name ?? '').toLowerCase()

  if (matchNames.some((match) => name.includes(match))) {
    const total = record.total ?? record.closing_balance ?? record.total_amount
    const parsed = typeof total === 'number' ? total : parseFloat(String(total ?? '0'))
    if (Number.isFinite(parsed) && parsed !== 0) return parsed
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const found = findReportTotal(value, matchNames)
      if (found) return found
    }
  }

  return 0
}

export class ZohoBooksAdapter implements AccountingAdapter {
  readonly provider = 'zoho_books' as const
  readonly label = 'Zoho Books'

  getAuthUrl(state: string) {
    const { clientId, redirectUri } = getCredentials()
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: ZOHO_BOOKS_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    return `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${params.toString()}`
  }

  async exchangeCodeForTokens(
    code: string,
    _state: string,
    extra?: Record<string, string>
  ): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()
    const accountsDomain = resolveAccountsDomain(extra)

    const tokenResponse = await fetch(`${accountsDomain}/oauth/v2/token`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      console.error('Zoho Books token exchange failed', tokenResponse.status, errorBody)
      throw new Error(`Zoho Books token exchange failed: ${tokenResponse.status}`)
    }

    const token = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
      api_domain: string
    }

    const orgsResponse = await fetch(`${token.api_domain}/books/v3/organizations`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` },
    })

    if (!orgsResponse.ok) {
      throw new Error(`Zoho Books organizations fetch failed: ${orgsResponse.status}`)
    }

    const orgsPayload = (await orgsResponse.json()) as {
      organizations: Array<{ organization_id: string; name: string }>
    }
    const organization = orgsPayload.organizations?.[0]

    if (!organization) {
      throw new Error('No Zoho Books organization found for this connection')
    }

    // api_domain varies per-DC and is needed for every later API call, but
    // OAuthTokens has no dedicated field for it — packing it alongside the
    // organization id here is the same trick QuickBooks uses for realmId.
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: `${token.api_domain}::${organization.organization_id}`,
      tenantName: organization.name,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()
    const response = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
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

    if (!response.ok) throw new Error(`Zoho Books token refresh failed: ${response.status}`)
    const token = (await response.json()) as {
      access_token: string
      expires_in: number
    }

    return {
      accessToken: token.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: '',
      tenantName: '',
    }
  }

  async getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData> {
    const [apiDomain, organizationId] = tokens.tenantId.split('::')
    const today = new Date()
    const dateStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const dateEnd = today.toISOString().slice(0, 10)
    const headers = { Authorization: `Zoho-oauthtoken ${tokens.accessToken}` }

    const [balanceSheetResponse, profitLossResponse] = await Promise.all([
      fetch(
        `${apiDomain}/books/v3/reports/balancesheet?organization_id=${organizationId}&date=${dateEnd}`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
      fetch(
        `${apiDomain}/books/v3/reports/profitandloss?organization_id=${organizationId}&from_date=${dateStart}&to_date=${dateEnd}`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
    ])

    const balanceSheet = balanceSheetResponse.ok ? await balanceSheetResponse.json() : {}
    const profitLoss = profitLossResponse.ok ? await profitLossResponse.json() : {}

    return {
      cashBalance: findReportTotal(balanceSheet, ['cash', 'bank']),
      accountsReceivable: findReportTotal(balanceSheet, ['accounts receivable', 'receivable']),
      accountsPayable: findReportTotal(balanceSheet, ['accounts payable', 'payable']),
      monthlyRevenue: findReportTotal(profitLoss, ['operating income', 'income', 'revenue']),
      monthlyExpenses: findReportTotal(profitLoss, ['operating expense', 'expense']),
      currency: 'USD',
      asOf: dateEnd,
      raw: { balanceSheet, profitLoss },
    }
  }

  verifyWebhookSignature() {
    return false
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const record = payload as Record<string, unknown>
    const data = record.data as Record<string, unknown> | undefined

    return {
      provider: 'zoho_books',
      eventType: String(record.event_type ?? 'unknown'),
      tenantId: String(record.organization_id ?? ''),
      resourceId: data ? String(data.id ?? '') : undefined,
      raw: payload,
    }
  }
}
