import crypto from 'node:crypto'
import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '../types'

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

// Set QUICKBOOKS_ENV=sandbox in .env.local when testing with sandbox credentials.
const QB_API_BASE =
  process.env.QUICKBOOKS_ENV === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    : 'https://quickbooks.api.intuit.com/v3/company'

function getCredentials() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, or QUICKBOOKS_REDIRECT_URI'
    )
  }
  return { clientId, clientSecret, redirectUri }
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

// QuickBooks returns Data rows for single accounts and Section rows for grouped accounts.
function findRowValue(rows: unknown[], name: string): number {
  for (const row of rows) {
    const r = row as Record<string, unknown>

    // Data row: single account — ColData sits directly on the row
    const directColData = r.ColData as Array<{ value: string }> | undefined
    if (directColData?.[0]?.value === name) {
      return parseFloat(directColData?.[1]?.value ?? '0') || 0
    }

    // Section row: grouped accounts — name is in Header, amount is in Summary
    const header = r.Header as Record<string, unknown> | undefined
    const headerColData = header?.ColData as Array<{ value: string }> | undefined
    if (headerColData?.[0]?.value === name) {
      const summary = r.Summary as Record<string, unknown> | undefined
      const summaryData = summary?.ColData as Array<{ value: string }> | undefined
      return parseFloat(summaryData?.[1]?.value ?? '0') || 0
    }

    const nestedRows = (r.Rows as Record<string, unknown> | undefined)?.Row as
      | unknown[]
      | undefined
    if (nestedRows) {
      const found = findRowValue(nestedRows, name)
      if (found !== 0) return found
    }
  }
  return 0
}

export class QuickBooksAdapter implements AccountingAdapter {
  readonly provider = 'quickbooks' as const

  getAuthUrl(state: string): string {
    const { clientId, redirectUri } = getCredentials()
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      state,
    })
    return `${QB_AUTH_URL}?${params.toString()}`
  }

  async exchangeCodeForTokens(
    code: string,
    _state: string,
    extra?: Record<string, string>
  ): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()

    // QuickBooks sends realmId (company ID) as an extra query param in the callback
    const realmId = extra?.realmId
    if (!realmId) throw new Error('Missing realmId from QuickBooks callback')

    const tokenRes = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(clientId, clientSecret),
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) throw new Error(`QuickBooks token exchange failed: ${tokenRes.status}`)
    const token = (await tokenRes.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    // Fetch company name using the realmId
    const infoRes = await fetch(
      `${QB_API_BASE}/${realmId}/companyinfo/${realmId}?minorversion=65`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: 'application/json',
        },
      }
    )
    const infoData = infoRes.ok ? ((await infoRes.json()) as Record<string, unknown>) : {}
    const companyInfo = (
      infoData.QueryResponse as Record<string, unknown> | undefined
    )?.CompanyInfo as Array<{ CompanyName: string }> | undefined
    const tenantName = companyInfo?.[0]?.CompanyName ?? `QuickBooks (${realmId})`

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: realmId,
      tenantName,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()

    const res = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuthHeader(clientId, clientSecret),
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) throw new Error(`QuickBooks token refresh failed: ${res.status}`)
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
    const today = new Date().toISOString().slice(0, 10)
    const firstOfMonth = `${today.slice(0, 7)}-01`
    const base = `${QB_API_BASE}/${tokens.tenantId}`
    const headers = {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
    }

    const [bsRes, plRes] = await Promise.all([
      fetch(`${base}/reports/BalanceSheet?date=${today}&minorversion=65`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
      fetch(
        `${base}/reports/ProfitAndLoss?start_date=${firstOfMonth}&end_date=${today}&minorversion=65`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
    ])

    if (!bsRes.ok) throw new Error(`QuickBooks BalanceSheet failed: ${bsRes.status}`)
    if (!plRes.ok) throw new Error(`QuickBooks ProfitAndLoss failed: ${plRes.status}`)

    const [bsData, plData] = await Promise.all([bsRes.json(), plRes.json()])
    const bsRows =
      ((bsData as Record<string, unknown>).Rows as Record<string, unknown> | undefined)?.Row ??
      []
    const plRows =
      ((plData as Record<string, unknown>).Rows as Record<string, unknown> | undefined)?.Row ??
      []

    return {
      cashBalance: findRowValue(bsRows as unknown[], 'Bank Accounts'),
      accountsReceivable: findRowValue(bsRows as unknown[], 'Accounts Receivable (A/R)'),
      accountsPayable: findRowValue(bsRows as unknown[], 'Accounts Payable (A/P)'),
      monthlyRevenue: findRowValue(plRows as unknown[], 'Income'),
      monthlyExpenses: findRowValue(plRows as unknown[], 'Expenses'),
      currency: 'USD',
      asOf: today,
      raw: { balanceSheet: bsData, profitAndLoss: plData },
    }
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const token = process.env.QUICKBOOKS_WEBHOOK_TOKEN
    if (!token) return false
    const signature = headers['intuit-signature']
    if (!signature) return false
    const expected = crypto.createHmac('sha256', token).update(rawBody).digest('base64')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const p = payload as Record<string, unknown>
    const notifications = (p.eventNotifications as Array<Record<string, unknown>>) ?? []
    const first = notifications[0] ?? {}
    const dataChangeEvent = first.dataChangeEvent as Record<string, unknown> | undefined
    const entities = (dataChangeEvent?.entities as Array<Record<string, unknown>>) ?? []
    const entity = entities[0] ?? {}
    return {
      provider: 'quickbooks',
      eventType: String(entity.operation ?? 'unknown'),
      tenantId: String(first.realmId ?? ''),
      resourceId: entity.id ? String(entity.id) : undefined,
      raw: payload,
    }
  }
}
