import crypto from 'node:crypto'
import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'
const XERO_API_URL = 'https://api.xero.com/api.xro/2.0'
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

function parseNumber(value: string | undefined) {
  return parseFloat((value ?? '0').replace(/,/g, '')) || 0
}

function findRowValue(rows: unknown[], title: string): number {
  for (const row of rows) {
    const record = row as Record<string, unknown>
    const cells = record.Cells as Array<{ Value: string }> | undefined

    if (Array.isArray(cells) && cells[0]?.Value === title) {
      return parseNumber(cells[1]?.Value)
    }

    if (record.Title === title && Array.isArray(record.Rows)) {
      const nestedRows = record.Rows as Array<Record<string, unknown>>
      const summary = nestedRows.find((child) => child.RowType === 'SummaryRow')
      const summaryCells = summary?.Cells as Array<{ Value: string }> | undefined
      if (summaryCells) return parseNumber(summaryCells[1]?.Value)
    }

    if (Array.isArray(record.Rows)) {
      const found = findRowValue(record.Rows as unknown[], title)
      if (found !== 0) return found
    }
  }

  return 0
}

export class XeroAdapter implements AccountingAdapter {
  readonly provider = 'xero' as const
  readonly label = 'Xero'

  getAuthUrl(state: string) {
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
    const tokenResponse = await fetch(XERO_TOKEN_URL, {
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

    if (!tokenResponse.ok) throw new Error(`Xero token exchange failed: ${tokenResponse.status}`)
    const token = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const connectionsResponse = await fetch(XERO_CONNECTIONS_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!connectionsResponse.ok) {
      throw new Error(`Xero connections fetch failed: ${connectionsResponse.status}`)
    }

    const connections = (await connectionsResponse.json()) as Array<{
      tenantId: string
      tenantName: string
    }>
    const tenant = connections[0]
    if (!tenant) throw new Error('No Xero tenants connected')

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
    const response = await fetch(XERO_TOKEN_URL, {
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

    if (!response.ok) throw new Error(`Xero token refresh failed: ${response.status}`)
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
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Xero-Tenant-Id': tokens.tenantId,
      Accept: 'application/json',
    }

    const [balanceSheetResponse, profitLossResponse] = await Promise.all([
      fetch(`${XERO_API_URL}/Reports/BalanceSheet`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
      fetch(`${XERO_API_URL}/Reports/ProfitAndLoss?periods=1&timeframe=MONTH`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
    ])

    if (!balanceSheetResponse.ok) {
      throw new Error(`Xero BalanceSheet failed: ${balanceSheetResponse.status}`)
    }
    if (!profitLossResponse.ok) {
      throw new Error(`Xero ProfitAndLoss failed: ${profitLossResponse.status}`)
    }

    const [balanceSheet, profitLoss] = await Promise.all([
      balanceSheetResponse.json(),
      profitLossResponse.json(),
    ])
    const balanceReport = (balanceSheet as Record<string, unknown[]>).Reports?.[0] as
      | Record<string, unknown>
      | undefined
    const profitLossReport = (profitLoss as Record<string, unknown[]>).Reports?.[0] as
      | Record<string, unknown>
      | undefined

    const balanceRows = (balanceReport?.Rows as unknown[]) ?? []
    const profitLossRows = (profitLossReport?.Rows as unknown[]) ?? []

    return {
      cashBalance: findRowValue(balanceRows, 'Bank'),
      accountsReceivable: findRowValue(balanceRows, 'Accounts Receivable'),
      accountsPayable: findRowValue(balanceRows, 'Accounts Payable'),
      monthlyRevenue: findRowValue(profitLossRows, 'Total Income'),
      monthlyExpenses:
        findRowValue(profitLossRows, 'Less Cost of Sales') +
        findRowValue(profitLossRows, 'Less Operating Expenses'),
      currency: (balanceReport?.CurrencyCode as string) ?? 'USD',
      asOf: new Date().toISOString().slice(0, 10),
      raw: { balanceSheet, profitLoss },
    }
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>) {
    const webhookKey = process.env.XERO_WEBHOOK_KEY
    const signature = headers['x-xero-signature']
    if (!webhookKey || !signature) return false

    const expected = crypto.createHmac('sha256', webhookKey).update(rawBody).digest('base64')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const record = payload as Record<string, unknown>
    const events = (record.events as Array<Record<string, unknown>>) ?? []
    const first = events[0] ?? {}

    return {
      provider: 'xero',
      eventType: String(first.eventType ?? 'unknown'),
      tenantId: String(record.tenantId ?? first.tenantId ?? ''),
      resourceId: first.resourceId ? String(first.resourceId) : undefined,
      raw: payload,
    }
  }
}
