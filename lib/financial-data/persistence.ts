import { ApiError } from '@/lib/api/errors'
import { mapObservationRowToMetric } from '@/lib/financial-data/observation-mapping'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type {
  AvailableFinancialMetricValue,
  FinancialMetricSet,
} from '@/lib/financial-data/types'
import type { FinancialMetricObservation } from '@/types/database'

const FINANCIAL_METRIC_OBSERVATION_SELECT = `
  id,
  user_id,
  connection_id,
  document_id,
  metric_key,
  value,
  currency,
  period_start,
  period_end,
  as_of_date,
  source_type,
  source_label,
  confidence,
  evidence,
  raw_data,
  created_at,
  updated_at
`

export interface SaveFinancialMetricObservationParams {
  userId: string
  connectionId?: string | null
  documentId?: string | null
  metric: AvailableFinancialMetricValue
  rawData?: unknown
}

export async function saveFinancialMetricObservation({
  userId,
  connectionId = null,
  documentId = null,
  metric,
  rawData = {},
}: SaveFinancialMetricObservationParams) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_metric_observations')
    .insert({
      user_id: userId,
      connection_id: connectionId,
      document_id: documentId,
      metric_key: metric.key,
      value: metric.value,
      currency: metric.currency,
      period_start: metric.periodStart,
      period_end: metric.periodEnd,
      as_of_date: metric.asOfDate,
      source_type: metric.provenance.sourceType,
      source_label: metric.provenance.sourceLabel,
      confidence: metric.confidence,
      evidence: metric.provenance.evidence ?? {},
      raw_data: rawData,
      updated_at: metric.updatedAt,
    })
    .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
    .single()

  if (error || !data) {
    console.error('Failed to save financial metric observation.', error)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to save financial metric observation.',
      error?.message
    )
  }

  return data as FinancialMetricObservation
}

// --- COMMENTED OUT: returned observations from all connections including disconnected ones ---
// export async function listLatestFinancialMetricValues(userId: string) {
//   const supabase = createAdminSupabaseClient()
//   const { data, error } = await supabase
//     .from('financial_metric_observations')
//     .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
//     .eq('user_id', userId)
//     .order('metric_key', { ascending: true })
//     .order('updated_at', { ascending: false })
//   ...
// }
// --- END COMMENTED OUT ---

// --- START: listLatestFinancialMetricValues — filters to active connections only ---
export async function listLatestFinancialMetricValues(userId: string) {
  const supabase = createAdminSupabaseClient()

  // Only show observations from currently-active connections so that
  // disconnecting a provider immediately removes its data from the dashboard.
  // Observations from documents (connection_id IS NULL) are always included.
  const { data: activeConns } = await supabase
    .from('data_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'connected')

  const activeIds = (activeConns ?? []).map((c) => c.id as string)

  let query = supabase
    .from('financial_metric_observations')
    .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
    .eq('user_id', userId)
    .order('metric_key', { ascending: true })
    .order('updated_at', { ascending: false })

  if (activeIds.length > 0) {
    query = query.or(`connection_id.is.null,connection_id.in.(${activeIds.join(',')})`)
  } else {
    // No active connections — only show document-sourced observations
    query = query.is('connection_id', null)
  }

  const { data, error } = await query

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load financial metric observations.'
    )
  }

  const metrics: FinancialMetricSet = {}

  for (const row of (data ?? []) as FinancialMetricObservation[]) {
    if (metrics[row.metric_key]) {
      continue
    }

    metrics[row.metric_key] = mapObservationRowToMetric(row)
  }

  return metrics
}
// --- END: listLatestFinancialMetricValues ---
