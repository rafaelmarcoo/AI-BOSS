import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { encryptToken } from '@/lib/xero/crypto'
// --- START: xero initial sync imports ---
import { XeroAdapter } from '@/lib/integrations/adapters/xero'
import type { NormalizedFinancialData } from '@/lib/integrations/types'
// --- END: xero initial sync imports ---

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function getXeroOAuthConfig() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Xero OAuth environment variables are not configured.')
  }

  return { clientId, clientSecret, redirectUri }
}

function redirectToDashboard(status: 'connected' | 'error' | 'no_tenant') {
  return NextResponse.redirect(`${getAppUrl()}/dashboard?xero=${status}`)
}

function getBasicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam || !code || !state) {
    return redirectToDashboard('error')
  }

  try {
    const { user } = await requireAuthenticatedUser(request)
    const { clientId, clientSecret, redirectUri } = getXeroOAuthConfig()
    const supabase = createAdminSupabaseClient()

    const { data: stateRow, error: stateError } = await supabase
      .from('oauth_connection_states')
      .select('state')
      .eq('user_id', user.id)
      .eq('provider', 'xero')
      .eq('state', state)
      .maybeSingle()

    if (stateError || !stateRow) {
      return redirectToDashboard('error')
    }

    await supabase
      .from('oauth_connection_states')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'xero')

    const tokenResponse = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: getBasicAuthHeader(clientId, clientSecret),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      return redirectToDashboard('error')
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const connectionsResponse = await fetch(XERO_CONNECTIONS_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!connectionsResponse.ok) {
      return redirectToDashboard('error')
    }

    const connections = (await connectionsResponse.json()) as Array<{
      tenantId: string
      tenantName: string
    }>
    const tenant = connections[0]

    if (!tenant) {
      return redirectToDashboard('no_tenant')
    }

    const now = new Date().toISOString()
    const { data: dataConnection, error: dataConnectionError } = await supabase
      .from('data_connections')
      .upsert(
        {
          user_id: user.id,
          provider: 'xero',
          status: 'connected',
          display_name: tenant.tenantName,
          source_label: 'Xero',
          connected_at: now,
          disconnected_at: null,
          error_message: null,
          metadata: { tenantId: tenant.tenantId },
          updated_at: now,
        },
        { onConflict: 'user_id,provider' }
      )
      .select('id')
      .single()

    if (dataConnectionError || !dataConnection) {
      return redirectToDashboard('error')
    }

    const { error: upsertError } = await supabase
      .from('xero_connections')
      .upsert(
        {
          connection_id: dataConnection.id,
          user_id: user.id,
          tenant_id: tenant.tenantId,
          tenant_name: tenant.tenantName,
          access_token_enc: await encryptToken(tokens.access_token),
          refresh_token_enc: await encryptToken(tokens.refresh_token),
          expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          connected_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      return redirectToDashboard('error')
    }

    // --- START: xero initial sync — write snapshot so dashboard shows data on first load ---
    try {
      const xeroAdapter = new XeroAdapter()
      const xeroTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
      }
      const snapshot = await xeroAdapter.getFinancialSnapshot(xeroTokens)
      const today = new Date()
      const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

      type MetricKey =
        | 'cash'
        | 'accounts_receivable'
        | 'accounts_payable'
        | 'monthly_revenue'
        | 'monthly_expenses'

      const METRIC_MAP: Array<{ key: MetricKey; field: keyof NormalizedFinancialData }> = [
        { key: 'cash', field: 'cashBalance' },
        { key: 'accounts_receivable', field: 'accountsReceivable' },
        { key: 'accounts_payable', field: 'accountsPayable' },
        { key: 'monthly_revenue', field: 'monthlyRevenue' },
        { key: 'monthly_expenses', field: 'monthlyExpenses' },
      ]

      await supabase.from('financial_metric_observations').insert(
        METRIC_MAP.map(({ key, field }) => ({
          user_id: user.id,
          connection_id: dataConnection.id,
          metric_key: key,
          value: snapshot[field] as number,
          currency: snapshot.currency,
          period_start: periodStart,
          period_end: snapshot.asOf,
          as_of_date: snapshot.asOf,
          source_type: 'xero',
          source_label: tenant.tenantName,
          confidence: 1,
          evidence: {},
          raw_data: snapshot.raw as object,
        }))
      )
    } catch (syncErr) {
      // Don't fail the connect flow if snapshot fails — data will arrive via webhook later
      console.error('[xero:callback] initial sync failed:', syncErr)
    }
    // --- END: xero initial sync ---

    return redirectToDashboard('connected')
  } catch (error) {
    console.error(error)

    return redirectToDashboard('error')
  }
}
