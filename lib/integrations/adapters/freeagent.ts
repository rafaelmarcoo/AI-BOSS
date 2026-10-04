import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

function getBaseUrl() {
  return process.env.FREEAGENT_ENV === 'production'
    ? 'https://api.freeagent.com'
    : 'https://api.sandbox.freeagent.com'
}

function getCredentials() {
  const clientId = process.env.FREEAGENT_CLIENT_ID
  const clientSecret = process.env.FREEAGENT_CLIENT_SECRET
  const redirectUri = process.env.FREEAGENT_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('FreeAgent is not configured.')
  }
  return { clientId, clientSecret, redirectUri }
}

function basicAuth(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

function findAccountTotal(
  accounts: Array<{ name?: string; total_debit_value?: number }> | undefined,
  names: string[]
) {
  const account = accounts?.find((entry) =>
    names.some((name) => entry.name?.toLowerCase().includes(name))
  )
  return typeof account?.total_debit_value === 'number' ? account.total_debit_value : 0
}

export class FreeAgentAdapter implements AccountingAdapter {
  readonly provider = 'freeagent' as const
  readonly label = 'FreeAgent'

  getAuthUrl(state: string) {
    const { clientId, redirectUri } = getCredentials()
    return `${getBaseUrl()}/v2/approve_app?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    })}`
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()
    const response = await fetch(`${getBaseUrl()}/v2/token_endpoint`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuth(clientId, clientSecret),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })
    if (!response.ok) throw new Error(`FreeAgent token exchange failed: ${response.status}`)
    const token = (await response.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }
    const companyResponse = await fetch(`${getBaseUrl()}/v2/company`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    if (!companyResponse.ok) throw new Error(`FreeAgent company lookup failed: ${companyResponse.status}`)
    const payload = (await companyResponse.json()) as {
      company: { id: string; name: string }
    }
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: payload.company.id,
      tenantName: payload.company.name,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()
    const response = await fetch(`${getBaseUrl()}/v2/token_endpoint`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuth(clientId, clientSecret),
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    })
    if (!response.ok) throw new Error(`FreeAgent token refresh failed: ${response.status}`)
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
    const base = getBaseUrl()
    const today = new Date()
    const dateStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const dateEnd = today.toISOString().slice(0, 10)
    const headers = { Authorization: `Bearer ${tokens.accessToken}` }
    const [companyResponse, balanceResponse, profitResponse] = await Promise.all([
      fetch(`${base}/v2/company`, { signal: AbortSignal.timeout(10_000), headers }),
      fetch(`${base}/v2/accounting/balance_sheet?as_at_date=${dateEnd}`, { signal: AbortSignal.timeout(15_000), headers }),
      fetch(`${base}/v2/accounting/profit_and_loss/summary?from_date=${dateStart}&to_date=${dateEnd}`, { signal: AbortSignal.timeout(15_000), headers }),
    ])
    if (!companyResponse.ok || !balanceResponse.ok || !profitResponse.ok) {
      throw new Error('FreeAgent financial reports could not be loaded.')
    }
    const company = (await companyResponse.json()) as {
      company?: { currency?: string; currency_code?: string }
    }
    const balanceSheet = (await balanceResponse.json()) as {
      balance_sheet?: {
        current_assets?: { accounts?: Array<{ name?: string; total_debit_value?: number }> }
        current_liabilities?: { accounts?: Array<{ name?: string; total_debit_value?: number }> }
      }
    }
    const profitLoss = (await profitResponse.json()) as {
      profit_and_loss_summary?: { income?: string; expenses?: string }
    }
    const assets = balanceSheet.balance_sheet?.current_assets?.accounts
    const liabilities = balanceSheet.balance_sheet?.current_liabilities?.accounts
    return {
      cashBalance: findAccountTotal(assets, ['bank']),
      accountsReceivable: findAccountTotal(assets, ['debtor', 'receivable']),
      accountsPayable: Math.abs(findAccountTotal(liabilities, ['creditor', 'payable'])),
      monthlyRevenue: Number(profitLoss.profit_and_loss_summary?.income) || 0,
      monthlyExpenses: Number(profitLoss.profit_and_loss_summary?.expenses) || 0,
      currency: String(company.company?.currency_code ?? company.company?.currency ?? '').toUpperCase(),
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
      tenantId: '',
      raw: payload,
    }
  }
}
