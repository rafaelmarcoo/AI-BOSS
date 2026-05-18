import type { AccountingProvider, NormalizedFinancialData } from '@/lib/integrations/types'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'

type SnapshotMetricKey = Extract<
  FinancialMetricKey,
  'cash' | 'accounts_receivable' | 'accounts_payable' | 'monthly_revenue' | 'monthly_expenses'
>

const METRIC_MAP: Array<{ key: SnapshotMetricKey; field: keyof NormalizedFinancialData }> = [
  { key: 'cash', field: 'cashBalance' },
  { key: 'accounts_receivable', field: 'accountsReceivable' },
  { key: 'accounts_payable', field: 'accountsPayable' },
  { key: 'monthly_revenue', field: 'monthlyRevenue' },
  { key: 'monthly_expenses', field: 'monthlyExpenses' },
]

export async function saveAccountingSnapshot(params: {
  userId: string
  connectionId: string
  provider: AccountingProvider
  sourceLabel: string
  snapshot: NormalizedFinancialData
}) {
  const supabase = createAdminSupabaseClient()
  const now = new Date().toISOString()
  const today = new Date()
  const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  const { error } = await supabase.from('financial_metric_observations').insert(
    METRIC_MAP.map(({ key, field }) => ({
      user_id: params.userId,
      connection_id: params.connectionId,
      metric_key: key,
      value: params.snapshot[field] as number,
      currency: params.snapshot.currency,
      period_start: periodStart,
      period_end: params.snapshot.asOf,
      as_of_date: params.snapshot.asOf,
      source_type: params.provider,
      source_label: params.sourceLabel,
      confidence: 1,
      evidence: {},
      raw_data: params.snapshot.raw as object,
    }))
  )

  if (error) {
    throw new Error(`Failed to write accounting observations: ${error.message}`)
  }

  await supabase
    .from('data_connections')
    .update({ last_synced_at: now, updated_at: now, error_message: null })
    .eq('id', params.connectionId)
}
