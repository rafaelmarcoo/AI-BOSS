import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/responses'
import { getAdapter } from '@/lib/integrations/registry'
import { consumeOAuthState, storeConnection } from '@/lib/integrations/connections'

// --- START: initial sync imports ---
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { NormalizedFinancialData } from '@/lib/integrations/types'
// --- END: initial sync imports ---

// --- START: initial sync metric map ---
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
// --- END: initial sync metric map ---

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const errorParam = url.searchParams.get('error')

    if (errorParam || !code || !state) {
      return NextResponse.redirect(`${getAppUrl()}/dashboard?integration_error=${provider}`)
    }

    const { userId, redirectPath } = await consumeOAuthState(state)
    const adapter = getAdapter(provider)

    // Collect any extra query params the provider sends (e.g. QuickBooks sends realmId)
    const extra: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      if (key !== 'code' && key !== 'state') extra[key] = value
    })

    const tokens = await adapter.exchangeCodeForTokens(code, state, extra)

    // --- COMMENTED OUT: connectionId now captured for initial sync below ---
    // await storeConnection(userId, adapter.provider, tokens)
    // --- END COMMENTED OUT ---

    // --- START: capture connectionId for initial sync ---
    const connectionId = await storeConnection(userId, adapter.provider, tokens)
    // --- END: capture connectionId ---

    // --- START: initial sync — write snapshot immediately so dashboard shows data on first load ---
    try {
      const snapshot = await adapter.getFinancialSnapshot(tokens)
      const supabase = createAdminSupabaseClient()
      const today = new Date()
      const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

      await supabase.from('financial_metric_observations').insert(
        METRIC_MAP.map(({ key, field }) => ({
          user_id: userId,
          connection_id: connectionId,
          metric_key: key,
          value: snapshot[field] as number,
          currency: snapshot.currency,
          period_start: periodStart,
          period_end: snapshot.asOf,
          as_of_date: snapshot.asOf,
          source_type: adapter.provider,
          source_label: tokens.tenantName,
          confidence: 1,
          evidence: {},
          raw_data: snapshot.raw as object,
        }))
      )
    } catch (syncErr) {
      // Don't fail the connect flow if snapshot fails — data will arrive via webhook later
      console.error(`[integrations:callback] initial sync failed for ${provider}:`, syncErr)
    }
    // --- END: initial sync ---

    return NextResponse.redirect(
      `${getAppUrl()}${redirectPath}?integration_connected=${provider}`
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
