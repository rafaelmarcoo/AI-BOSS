import crypto from 'node:crypto'
import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
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

function parseAmount(value: string | undefined) {
  return parseFloat((value ?? '0').replace(/,/g, '')) || 0
}

function findRowValue(rows: unknown[], name: string): number {
  for (const row of rows) {
    const record = row as Record<string, unknown>
    const direct = record.ColData as Array<{ value: string }> | undefined
    if (direct?.[0]?.value === name) return parseAmount(direct[1]?.value)

    const header = record.Header as Record<string, unknown> | undefined
    const headerData = header?.ColData as Array<{ value: string }> | undefined
    if (headerData?.[0]?.value === name) {
      const summary = record.Summary as Record<string, unknown> | undefined
      const summaryData = summary?.ColData as Array<{ value: string }> | undefined
      return parseAmount(summaryData?.[1]?.value)
    }

    const nestedRows = (record.Rows as Record<string, unknown> | undefined)?.Row as
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
  readonly label = 'QuickBooks'

  getAuthUrl(state: string) {
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
    const realmId = extra?.realmId
    if (!realmId) throw new Error('Missing realmId from QuickBooks callback')

    const tokenResponse = await fetch(QB_TOKEN_URL, {
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

    if (!tokenResponse.ok) {
      throw new Error(`QuickBooks token exchange failed: ${tokenResponse.status}`)
    }
    const token = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const infoResponse = await fetch(
      `${QB_API_BASE}/${realmId}/companyinfo/${realmId}?minorversion=65`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
      }
    )
    const info = infoResponse.ok ? ((await infoResponse.json()) as Record<string, unknown>) : {}
    const companyInfo = (
      info.QueryResponse as Record<string, unknown> | undefined
    )?.CompanyInfo as Array<{ CompanyName: string }> | undefined

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: realmId,
      tenantName: companyInfo?.[0]?.CompanyName ?? `QuickBooks (${realmId})`,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()
    const response = await fetch(QB_TOKEN_URL, {
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

    if (!response.ok) throw new Error(`QuickBooks token refresh failed: ${response.status}`)
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
    const today = new Date().toISOString().slice(0, 10)
    const firstOfMonth = `${today.slice(0, 7)}-01`
    const base = `${QB_API_BASE}/${tokens.tenantId}`
    const headers = { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'application/json' }

    const [balanceSheetResponse, profitLossResponse] = await Promise.all([
      fetch(`${base}/reports/BalanceSheet?date=${today}&minorversion=65`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
      fetch(
        `${base}/reports/ProfitAndLoss?start_date=${firstOfMonth}&end_date=${today}&minorversion=65`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
    ])

    if (!balanceSheetResponse.ok) {
      throw new Error(`QuickBooks BalanceSheet failed: ${balanceSheetResponse.status}`)
    }
    if (!profitLossResponse.ok) {
      throw new Error(`QuickBooks ProfitAndLoss failed: ${profitLossResponse.status}`)
    }

    const [balanceSheet, profitLoss] = await Promise.all([
      balanceSheetResponse.json(),
      profitLossResponse.json(),
    ])
    const balanceRows =
      ((balanceSheet as Record<string, unknown>).Rows as Record<string, unknown> | undefined)
        ?.Row ?? []
    const profitLossRows =
      ((profitLoss as Record<string, unknown>).Rows as Record<string, unknown> | undefined)
        ?.Row ?? []

    return {
      cashBalance: findRowValue(balanceRows as unknown[], 'Bank Accounts'),
      accountsReceivable: findRowValue(balanceRows as unknown[], 'Accounts Receivable (A/R)'),
      accountsPayable: findRowValue(balanceRows as unknown[], 'Accounts Payable (A/P)'),
      monthlyRevenue: findRowValue(profitLossRows as unknown[], 'Income'),
      monthlyExpenses: findRowValue(profitLossRows as unknown[], 'Expenses'),
      currency: 'USD',
      asOf: today,
      raw: { balanceSheet, profitLoss },
    }
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>) {
    const token = process.env.QUICKBOOKS_WEBHOOK_TOKEN
    const signature = headers['intuit-signature']
    if (!token || !signature) return false

    const expected = crypto.createHmac('sha256', token).update(rawBody).digest('base64')
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const record = payload as Record<string, unknown>
    const notifications = (record.eventNotifications as Array<Record<string, unknown>>) ?? []
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
