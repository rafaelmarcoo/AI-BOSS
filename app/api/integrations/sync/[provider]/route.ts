import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError } from '@/lib/api/responses'
import { getValidTokens } from '@/lib/integrations/connections'
import { getAdapter } from '@/lib/integrations/registry'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { AccountingProvider, NormalizedFinancialData } from '@/lib/integrations/types'

// --- START: manual sync endpoint — fetches fresh data from provider and writes to DB ---
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const { user } = await requireAuthenticatedUser(request)

    const tokens = await getValidTokens(user.id, provider as AccountingProvider)
    const adapter = getAdapter(provider)
    const snapshot = await adapter.getFinancialSnapshot(tokens)

    const supabase = createAdminSupabaseClient()
    const today = new Date()
    const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

    const { error } = await supabase.from('financial_metric_observations').insert(
      METRIC_MAP.map(({ key, field }) => ({
        user_id: user.id,
        connection_id: tokens.connectionId,
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

    if (error) throw new Error(`Failed to write observations: ${error.message}`)

    // Update last_synced_at on the connection row
    await supabase
      .from('data_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('provider', provider)

    return NextResponse.json({ ok: true, asOf: snapshot.asOf })
  } catch (err) {
    return handleRouteError(err)
  }
}
// --- END: manual sync endpoint ---
