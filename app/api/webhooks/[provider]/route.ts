import { NextRequest, NextResponse } from 'next/server'
import { getAdapter } from '@/lib/integrations/registry'
import { findUserByTenant, getValidTokens } from '@/lib/integrations/connections'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { AccountingProvider, NormalizedFinancialData } from '@/lib/integrations/types'

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
  const { provider } = await params

  // Raw body must be read before any parsing — required for HMAC signature verification
  const rawBody = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  let adapter
  try {
    adapter = getAdapter(provider)
  } catch {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  if (!adapter.verifyWebhookSignature(rawBody, headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // After signature verification, always return 200 — errors are logged, not retried
  try {
    const payload = JSON.parse(rawBody) as unknown
    const event = adapter.parseWebhookEvent(payload)

    if (!event.tenantId) return NextResponse.json({ received: true })

    const record = await findUserByTenant(adapter.provider as AccountingProvider, event.tenantId)
    if (!record) return NextResponse.json({ received: true })

    const { userId, connectionId } = record
    const tokens = await getValidTokens(userId, adapter.provider as AccountingProvider)
    const snapshot = await adapter.getFinancialSnapshot(tokens)

    const supabase = createAdminSupabaseClient()
    const now = new Date().toISOString()
    const today = new Date()
    const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const periodEnd = snapshot.asOf

    await supabase.from('financial_metric_observations').insert(
      METRIC_MAP.map(({ key, field }) => ({
        user_id: userId,
        connection_id: connectionId,
        metric_key: key,
        value: snapshot[field] as number,
        currency: snapshot.currency,
        period_start: periodStart,
        period_end: periodEnd,
        as_of_date: snapshot.asOf,
        source_type: adapter.provider,
        source_label: tokens.tenantName,
        confidence: 1,
        evidence: {},
        raw_data: snapshot.raw as object,
      }))
    )

    await supabase
      .from('data_connections')
      .update({ last_synced_at: now })
      .eq('id', connectionId)
  } catch (err) {
    console.error(`[webhook:${provider}] processing error`, err)
  }

  return NextResponse.json({ received: true })
}
