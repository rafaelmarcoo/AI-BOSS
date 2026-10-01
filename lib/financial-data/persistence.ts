import { ApiError } from '@/lib/api/errors'
import { mapObservationRowToMetric } from '@/lib/financial-data/observation-mapping'
import { selectLatestFinancialMetricObservations } from '@/lib/financial-data/latest-observation'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type {
  AvailableFinancialMetricValue,
  FinancialMetricSet,
} from '@/lib/financial-data/types'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
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

export interface SaveFinancialMetricObservationsParams {
  userId: string
  connectionId?: string | null
  documentId?: string | null
  metrics: AvailableFinancialMetricValue[]
  rawData?: unknown
}

export async function deleteFinancialMetricObservationsForDocument(
  documentId: string,
  userId: string
) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('financial_metric_observations')
    .delete()
    .eq('document_id', documentId)
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to remove document-derived financial metrics.', error)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to remove document-derived financial metrics.',
      error.message
    )
  }
}

export async function saveFinancialMetricObservations({
  userId,
  connectionId = null,
  documentId = null,
  metrics,
  rawData = {},
}: SaveFinancialMetricObservationsParams) {
  if (metrics.length === 0) return []

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_metric_observations')
    .insert(
      metrics.map((metric) => ({
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
      }))
    )
    .select(FINANCIAL_METRIC_OBSERVATION_SELECT)

  if (error || !data) {
    console.error('Failed to save financial metric observations.', error)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to save financial metric observations.',
      error?.message
    )
  }

  return data as FinancialMetricObservation[]
}

export async function saveFinancialMetricObservation({
  userId,
  connectionId = null,
  documentId = null,
  metric,
  rawData = {},
}: SaveFinancialMetricObservationParams) {
  const rows = await saveFinancialMetricObservations({
    userId,
    connectionId,
    documentId,
    metrics: [metric],
    rawData,
  })

  return rows[0] as FinancialMetricObservation
}

export async function listLatestFinancialMetricValues(userId: string) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_metric_observations')
    .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
    .eq('user_id', userId)
    .order('metric_key', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load financial metric observations.'
    )
  }

  const metrics: FinancialMetricSet = {}

  for (const row of selectLatestFinancialMetricObservations(
    (data ?? []) as FinancialMetricObservation[]
  )) {
    metrics[row.metric_key] = mapObservationRowToMetric(row)
  }

  return metrics
}

export interface FinancialMetricBySource {
  id: string
  metricKey: FinancialMetricKey
  sourceType: string
  sourceLabel: string
  value: number
  currency: string | null
  documentId: string | null
  connectionId: string | null
}

export async function listLatestFinancialMetricValuesBySource(
  userId: string
): Promise<FinancialMetricBySource[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_metric_observations')
    .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load financial metric observations.'
    )
  }

  const latestBySourceAndMetric = new Map<string, FinancialMetricObservation>()

  for (const row of (data ?? []) as FinancialMetricObservation[]) {
    // Group by the actual document/connection, not just source_type — every
    // "document" upload otherwise shares one bucket per metric_key and
    // silently overwrites other uploads' values for the same metric.
    const sourceIdentity = row.document_id ?? row.connection_id ?? row.source_type
    const groupKey = `${row.metric_key}::${sourceIdentity}`

    if (!latestBySourceAndMetric.has(groupKey)) {
      latestBySourceAndMetric.set(groupKey, row)
    }
  }

  return [...latestBySourceAndMetric.values()].map((row) => ({
    id: row.id,
    metricKey: row.metric_key,
    sourceType: row.source_type,
    sourceLabel: row.source_label,
    value: Number(row.value),
    currency: row.currency,
    documentId: row.document_id,
    connectionId: row.connection_id,
  }))
}

export async function updateFinancialMetricObservationValue(params: {
  userId: string
  observationId: string
  value: number
}) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_metric_observations')
    .update({ value: params.value, updated_at: new Date().toISOString() })
    .eq('id', params.observationId)
    .eq('user_id', params.userId)
    .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
    .maybeSingle()

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to update financial metric observation.'
    )
  }

  if (!data) {
    throw new ApiError(404, 'NOT_FOUND', 'Financial metric observation not found.')
  }

  return data as FinancialMetricObservation
}

/**
 * Bulk-sets the currency on every observation derived from one document —
 * currency is chosen once per upload and applies to all of its metrics, not
 * set per-value like the observation's own numeric value is.
 */
export async function updateFinancialMetricObservationsCurrencyForDocument(params: {
  userId: string
  documentId: string
  currency: string
}) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('financial_metric_observations')
    .update({ currency: params.currency, updated_at: new Date().toISOString() })
    .eq('document_id', params.documentId)
    .eq('user_id', params.userId)

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to update financial metric observation currency.'
    )
  }
}

export async function listFinancialMetricObservationHistory(params: {
  userId: string
  metricKey: FinancialMetricKey
  limit?: number
}) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_metric_observations')
    .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
    .eq('user_id', params.userId)
    .eq('metric_key', params.metricKey)
    .order('as_of_date', { ascending: false, nullsFirst: false })
    .order('period_end', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(params.limit ?? 6)

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load financial metric observation history.'
    )
  }

  return ((data ?? []) as FinancialMetricObservation[])
    .map(mapObservationRowToMetric)
    .reverse()
}
