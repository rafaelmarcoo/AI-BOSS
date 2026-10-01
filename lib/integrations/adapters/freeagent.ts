import type {
  AccountingAdapter,
  NormalizedFinancialData,
  OAuthTokens,
  WebhookEvent,
} from '@/lib/integrations/types'

const isSandbox = process.env.FREEAGENT_ENV !== 'production'
const FREEAGENT_BASE = isSandbox
  ? 'https://api.sandbox.freeagent.com'
  : 'https://api.freeagent.com'
const FREEAGENT_AUTH_URL = `${FREEAGENT_BASE}/v2/approve_app`
const FREEAGENT_TOKEN_URL = `${FREEAGENT_BASE}/v2/token_endpoint`

function getCredentials() {
  const clientId = process.env.FREEAGENT_CLIENT_ID
  const clientSecret = process.env.FREEAGENT_CLIENT_SECRET
  const redirectUri = process.env.FREEAGENT_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing FREEAGENT_CLIENT_ID, FREEAGENT_CLIENT_SECRET, or FREEAGENT_REDIRECT_URI')
  }

  return { clientId, clientSecret, redirectUri }
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

interface BalanceSheetAccount {
  name?: string
  total_debit_value?: number
}

function findAccountTotal(accounts: BalanceSheetAccount[] | undefined, matchNames: string[]) {
  if (!accounts) return 0

  for (const account of accounts) {
    const name = (account.name ?? '').toLowerCase()
    if (matchNames.some((match) => name.includes(match))) {
      return typeof account.total_debit_value === 'number' ? account.total_debit_value : 0
    }
  }

  return 0
}

export class FreeAgentAdapter implements AccountingAdapter {
  readonly provider = 'freeagent' as const
  readonly label = 'FreeAgent'

  getAuthUrl(state: string) {
    const { clientId, redirectUri } = getCredentials()
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    })

    return `${FREEAGENT_AUTH_URL}?${params.toString()}`
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()
    const tokenResponse = await fetch(FREEAGENT_TOKEN_URL, {
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

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      console.error('FreeAgent token exchange failed', tokenResponse.status, errorBody)
      throw new Error(`FreeAgent token exchange failed: ${tokenResponse.status}`)
    }

    const token = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const companyResponse = await fetch(`${FREEAGENT_BASE}/v2/company`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    })

    if (!companyResponse.ok) {
      throw new Error(`FreeAgent company fetch failed: ${companyResponse.status}`)
    }

    const companyPayload = (await companyResponse.json()) as {
      company: { id: string; name: string }
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      tenantId: companyPayload.company.id,
      tenantName: companyPayload.company.name,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId, clientSecret } = getCredentials()
    const response = await fetch(FREEAGENT_TOKEN_URL, {
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
    const today = new Date()
    const dateStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const dateEnd = today.toISOString().slice(0, 10)
    const headers = { Authorization: `Bearer ${tokens.accessToken}` }

    const [balanceSheetResponse, profitLossResponse] = await Promise.all([
      fetch(`${FREEAGENT_BASE}/v2/accounting/balance_sheet?as_at_date=${dateEnd}`, {
        signal: AbortSignal.timeout(15_000),
        headers,
      }),
      fetch(
        `${FREEAGENT_BASE}/v2/accounting/profit_and_loss/summary?from_date=${dateStart}&to_date=${dateEnd}`,
        { signal: AbortSignal.timeout(15_000), headers }
      ),
    ])

    const balanceSheet = balanceSheetResponse.ok
      ? ((await balanceSheetResponse.json()) as {
          balance_sheet?: {
            current_assets?: { accounts?: BalanceSheetAccount[] }
            current_liabilities?: { accounts?: BalanceSheetAccount[] }
          }
        })
      : {}
    const profitLoss = profitLossResponse.ok
      ? ((await profitLossResponse.json()) as {
          profit_and_loss_summary?: { income?: string; expenses?: string }
        })
      : {}

    const currentAssets = balanceSheet.balance_sheet?.current_assets?.accounts
    const currentLiabilities = balanceSheet.balance_sheet?.current_liabilities?.accounts

    return {
      cashBalance: findAccountTotal(currentAssets, ['bank']),
      accountsReceivable: findAccountTotal(currentAssets, ['debtor', 'receivable']),
      // FreeAgent reports liabilities as negative debit values (money owed by
      // the business) — flip the sign so this reads as a positive amount owed.
      accountsPayable: Math.abs(findAccountTotal(currentLiabilities, ['creditor', 'payable'])),
      monthlyRevenue: parseFloat(profitLoss.profit_and_loss_summary?.income ?? '0') || 0,
      monthlyExpenses: parseFloat(profitLoss.profit_and_loss_summary?.expenses ?? '0') || 0,
      currency: 'GBP',
      asOf: dateEnd,
      raw: { balanceSheet, profitLoss },
    }
  }

  verifyWebhookSignature() {
    return false
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const record = payload as Record<string, unknown>
    return {
      provider: 'freeagent',
      eventType: String(record.event_type ?? 'unknown'),
      tenantId: '',
      raw: payload,
    }
  }
}
