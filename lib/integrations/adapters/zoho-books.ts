import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'
const ZOHO_BOOKS_SCOPE = 'ZohoBooks.fullaccess.all'
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

const ZOHO_API_DOMAINS = new Set([
  'https://www.zohoapis.com',
  'https://www.zohoapis.eu',
  'https://www.zohoapis.in',
  'https://www.zohoapis.com.au',
  'https://www.zohoapis.jp',
  'https://www.zohoapis.ca',
  'https://www.zohoapis.sa',
  'https://www.zohoapis.uk',
  'https://www.zohoapis.com.cn',
])
const PACKED_REFRESH_PREFIX = 'zoho-refresh:'

function getCredentials() {
  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const redirectUri = process.env.ZOHO_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Zoho Books is not configured.')
  }
  return { clientId, clientSecret, redirectUri }
}

function resolveAccountsDomain(extra?: Record<string, string>) {
  const location = extra?.location?.toLowerCase()
  if (location && LOCATION_TO_ACCOUNTS_DOMAIN[location]) {
    return LOCATION_TO_ACCOUNTS_DOMAIN[location]
  }

  const accountsServer = extra?.['accounts-server']
  if (accountsServer && Object.values(LOCATION_TO_ACCOUNTS_DOMAIN).includes(accountsServer)) {
    return accountsServer
  }

  return ZOHO_ACCOUNTS_URL
}

function requireZohoApiDomain(value: string) {
  let origin: string
  try {
    origin = new URL(value).origin
  } catch {
    throw new Error('Zoho Books returned an invalid API domain.')
  }
  if (!ZOHO_API_DOMAINS.has(origin)) {
    throw new Error('Zoho Books returned an unsupported API domain.')
  }
  return origin
}

function packRefreshToken(token: string, accountsDomain: string) {
  const payload = Buffer.from(JSON.stringify({ token, accountsDomain })).toString(
    'base64url'
  )
  return `${PACKED_REFRESH_PREFIX}${payload}`
}

function unpackRefreshToken(value: string) {
  if (!value.startsWith(PACKED_REFRESH_PREFIX)) {
    return { token: value, accountsDomain: ZOHO_ACCOUNTS_URL }
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value.slice(PACKED_REFRESH_PREFIX.length), 'base64url').toString(
        'utf8'
      )
    ) as { token?: unknown; accountsDomain?: unknown }
    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.accountsDomain !== 'string' ||
      !Object.values(LOCATION_TO_ACCOUNTS_DOMAIN).includes(parsed.accountsDomain)
    ) {
      throw new Error('invalid packed token')
    }
    return { token: parsed.token, accountsDomain: parsed.accountsDomain }
  } catch {
    throw new Error('Stored Zoho Books refresh metadata is invalid.')
  }
}

function findReportTotal(node: unknown, names: string[]): number {
  if (!node || typeof node !== 'object') return 0
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findReportTotal(item, names)
      if (found !== 0) return found
    }
    return 0
  }

  const record = node as Record<string, unknown>
  const name = String(record.name ?? record.account_name ?? '').toLowerCase()
  if (names.some((candidate) => name.includes(candidate))) {
    const value = Number(record.total ?? record.closing_balance ?? record.total_amount)
    if (Number.isFinite(value)) return value
  }

  for (const value of Object.values(record)) {
    const found = findReportTotal(value, names)
    if (found !== 0) return found
  }
  return 0
}

export class ZohoBooksAdapter implements AccountingAdapter {
  readonly provider = 'zoho_books' as const
  readonly label = 'Zoho Books'

  getAuthUrl(state: string) {
    const { clientId, redirectUri } = getCredentials()
    return `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: ZOHO_BOOKS_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    })}`
  }

  async exchangeCodeForTokens(
    code: string,
    _state: string,
    extra?: Record<string, string>
  ): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()
    const accountsDomain = resolveAccountsDomain(extra)
    const response = await fetch(`${accountsDomain}/oauth/v2/token`, {
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
    if (!response.ok) throw new Error(`Zoho Books token exchange failed: ${response.status}`)
    const token = (await response.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
      api_domain: string
    }
    const apiDomain = requireZohoApiDomain(token.api_domain)
    const organizations = await fetch(`${apiDomain}/books/v3/organizations`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` },
    })
    if (!organizations.ok) throw new Error(`Zoho Books organization lookup failed: ${organizations.status}`)
    const payload = (await organizations.json()) as {
      organizations?: Array<{ organization_id: string; name: string; currency_code?: string }>
    }
    const organization = payload.organizations?.[0]
    if (!organization) throw new Error('No Zoho Books organization was found.')

    return {
      accessToken: token.access_token,
      refreshToken: packRefreshToken(token.refresh_token, accountsDomain),
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: [apiDomain, organization.organization_id, organization.currency_code ?? ''].join('::'),
      tenantName: organization.name,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()
    const packed = unpackRefreshToken(refreshToken)
    const response = await fetch(`${packed.accountsDomain}/oauth/v2/token`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: packed.token,
      }),
    })
    if (!response.ok) throw new Error(`Zoho Books token refresh failed: ${response.status}`)
    const token = (await response.json()) as { access_token: string; expires_in: number }
    return {
      accessToken: token.access_token,
      refreshToken: packRefreshToken(packed.token, packed.accountsDomain),
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: '',
      tenantName: '',
    }
  }

  async getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData> {
    const [apiDomain, organizationId, currency = ''] = tokens.tenantId.split('::')
    if (!apiDomain || !organizationId) throw new Error('Zoho Books tenant metadata is incomplete.')
    const today = new Date()
    const dateStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const dateEnd = today.toISOString().slice(0, 10)
    const headers = { Authorization: `Zoho-oauthtoken ${tokens.accessToken}` }
    const [balanceResponse, profitResponse] = await Promise.all([
      fetch(`${apiDomain}/books/v3/reports/balancesheet?organization_id=${organizationId}&date=${dateEnd}`, { signal: AbortSignal.timeout(15_000), headers }),
      fetch(`${apiDomain}/books/v3/reports/profitandloss?organization_id=${organizationId}&from_date=${dateStart}&to_date=${dateEnd}`, { signal: AbortSignal.timeout(15_000), headers }),
    ])
    if (!balanceResponse.ok || !profitResponse.ok) throw new Error('Zoho Books reports could not be loaded.')
    const [balanceSheet, profitLoss] = await Promise.all([balanceResponse.json(), profitResponse.json()])
    return {
      cashBalance: findReportTotal(balanceSheet, ['cash', 'bank']),
      accountsReceivable: findReportTotal(balanceSheet, ['accounts receivable', 'receivable']),
      accountsPayable: findReportTotal(balanceSheet, ['accounts payable', 'payable']),
      monthlyRevenue: findReportTotal(profitLoss, ['operating income', 'income', 'revenue']),
      monthlyExpenses: findReportTotal(profitLoss, ['operating expense', 'expense']),
      currency: currency.toUpperCase(),
      asOf: dateEnd,
      raw: { balanceSheet, profitLoss },
    }
  }

  verifyWebhookSignature() { return false }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const record = payload as Record<string, unknown>
    return {
      provider: this.provider,
      eventType: String(record.event_type ?? 'unknown'),
      tenantId: String(record.organization_id ?? ''),
      raw: payload,
    }
  }
}
