import crypto from 'node:crypto'
import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '../types'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'
const XERO_API_URL = 'https://api.xero.com/api.xro/2.0'

// Matches the scopes used in the existing app/api/xero/connect route
const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.settings.read',
  'accounting.contacts.read',
  'accounting.invoices.read',
  'accounting.reports.profitandloss.read',
  'accounting.reports.balancesheet.read',
  'accounting.banktransactions.read',
].join(' ')

function getCredentials() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing XERO_CLIENT_ID, XERO_CLIENT_SECRET, or XERO_REDIRECT_URI')
  }
  return { clientId, clientSecret, redirectUri }
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

// Xero separates Title (on Section rows) from Cells (on Row/SummaryRow rows).
// Sections are matched by Title and resolved via their child SummaryRow.
// Xero formats numbers with commas ("25,000.00") so commas are stripped before parsing.
function parseXeroNumber(value: string | undefined): number {
  return parseFloat((value ?? '0').replace(/,/g, '')) || 0
}

function findRowValue(rows: unknown[], title: string): number {
  for (const row of rows) {
    const r = row as Record<string, unknown>
    const cells = r.Cells as Array<{ Value: string }> | undefined

    // Row or SummaryRow: match by Cells[0].Value
    if (Array.isArray(cells) && cells[0]?.Value === title) {
      return parseXeroNumber(cells[1]?.Value)
    }

    // Section: match by Title, then read its SummaryRow for the total
    if (r.Title === title && Array.isArray(r.Rows)) {
      const nestedRows = r.Rows as Array<Record<string, unknown>>
      const summaryRow = nestedRows.find((child) => child.RowType === 'SummaryRow')
      const summaryCells = summaryRow?.Cells as Array<{ Value: string }> | undefined
      if (summaryCells) return parseXeroNumber(summaryCells[1]?.Value)
    }

    // Recurse into nested rows
    if (Array.isArray(r.Rows)) {
      const found = findRowValue(r.Rows as unknown[], title)
      if (found !== 0) return found
    }
  }
  return 0
}

export class XeroAdapter implements AccountingAdapter {
  readonly provider = 'xero' as const

  getAuthUrl(state: string): string {
    const { clientId, redirectUri } = getCredentials()
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: XERO_SCOPES,
      state,
    })
    return `${XERO_AUTH_URL}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()

    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(clientId, clientSecret),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) throw new Error(`Xero token exchange failed: ${tokenRes.status}`)
    const token = (await tokenRes.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const connRes = await fetch(XERO_CONNECTIONS_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!connRes.ok) throw new Error(`Xero connections fetch failed: ${connRes.status}`)
    const connections = (await connRes.json()) as Array<{
      tenantId: string
      tenantName: string
    }>

    if (!connections.length) throw new Error('No Xero tenants connected')
    const tenant = connections[0]

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()

    const res = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(clientId, clientSecret),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) throw new Error(`Xero token refresh failed: ${res.status}`)
    const token = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    // Re-fetch tenant info since Xero doesn't return it in the refresh response
    const connRes = await fetch(XERO_CONNECTIONS_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    const connections = connRes.ok
      ? ((await connRes.json()) as Array<{ tenantId: string; tenantName: string }>)
      : []
    const tenant = connections[0]

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: tenant?.tenantId ?? '',
      tenantName: tenant?.tenantName ?? '',
    }
  }

  async getFinancialSnapshot(tokens: OAuthTokens): Promise<NormalizedFinancialData> {
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Xero-Tenant-Id': tokens.tenantId,
      Accept: 'application/json',
    }

    const [bsRes, plRes] = await Promise.all([
      fetch(`${XERO_API_URL}/Reports/BalanceSheet`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
      fetch(`${XERO_API_URL}/Reports/ProfitAndLoss?periods=1&timeframe=MONTH`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
    ])

    if (!bsRes.ok) throw new Error(`Xero BalanceSheet failed: ${bsRes.status}`)
    if (!plRes.ok) throw new Error(`Xero ProfitAndLoss failed: ${plRes.status}`)

    const [bsData, plData] = await Promise.all([bsRes.json(), plRes.json()])
    const bsReport = (bsData as Record<string, unknown[]>).Reports?.[0] as Record<string, unknown>
    const plReport = (plData as Record<string, unknown[]>).Reports?.[0] as Record<string, unknown>

    const bsRows = (bsReport?.Rows as unknown[]) ?? []
    const plRows = (plReport?.Rows as unknown[]) ?? []

    return {
      cashBalance: findRowValue(bsRows, 'Bank'),
      accountsReceivable: findRowValue(bsRows, 'Accounts Receivable'),
      accountsPayable: findRowValue(bsRows, 'Accounts Payable'),
      monthlyRevenue: findRowValue(plRows, 'Total Income'),
      monthlyExpenses:
        findRowValue(plRows, 'Less Cost of Sales') +
        findRowValue(plRows, 'Less Operating Expenses'),
      currency: (bsReport?.CurrencyCode as string) ?? 'USD',
      asOf: new Date().toISOString().slice(0, 10),
      raw: { balanceSheet: bsData, profitAndLoss: plData },
    }
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const webhookKey = process.env.XERO_WEBHOOK_KEY
    if (!webhookKey) return false
    const signature = headers['x-xero-signature']
    if (!signature) return false
    const expected = crypto.createHmac('sha256', webhookKey).update(rawBody).digest('base64')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const p = payload as Record<string, unknown>
    const events = (p.events as Array<Record<string, unknown>>) ?? []
    const first = events[0] ?? {}
    return {
      provider: 'xero',
      eventType: String(first.eventType ?? 'unknown'),
      tenantId: String(p.tenantId ?? first.tenantId ?? ''),
      resourceId: first.resourceId ? String(first.resourceId) : undefined,
      raw: payload,
    }
  }
}
