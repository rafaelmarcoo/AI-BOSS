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

export async function listFinancialMetricObservations(userId: string) {
  const supabase = createAdminSupabaseClient()
  const rows: FinancialMetricObservation[] = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('financial_metric_observations')
      .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new ApiError(
        500,
        'INTERNAL_ERROR',
        'Failed to load financial metric observations.'
      )
    }

    const page = (data ?? []) as FinancialMetricObservation[]
    rows.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return rows
}

export async function listFinancialMetricObservationsForDocuments(params: {
  userId: string
  documentIds: string[]
  limit?: number
}) {
  const documentIds = [...new Set(params.documentIds)]
  if (documentIds.length === 0) return []

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_metric_observations')
    .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
    .eq('user_id', params.userId)
    .in('document_id', documentIds)
    .order('as_of_date', { ascending: false, nullsFirst: false })
    .order('period_end', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(params.limit ?? 200)

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load confirmed document financial observations.'
    )
  }

  return (data ?? []) as FinancialMetricObservation[]
}

export async function listFinancialMetricObservationHistory(params: {
  userId: string
  metricKey: FinancialMetricKey
  limit?: number | 'all'
}) {
  const supabase = createAdminSupabaseClient()
  const rows: FinancialMetricObservation[] = []
  const requestedLimit = params.limit ?? 6
  const pageSize = 1000
  let offset = 0

  while (true) {
    const baseQuery = supabase
      .from('financial_metric_observations')
      .select(FINANCIAL_METRIC_OBSERVATION_SELECT)
      .eq('user_id', params.userId)
      .eq('metric_key', params.metricKey)
      .order('as_of_date', { ascending: false, nullsFirst: false })
      .order('period_end', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
    const { data, error } = requestedLimit === 'all'
      ? await baseQuery.range(offset, offset + pageSize - 1)
      : await baseQuery.limit(requestedLimit)

    if (error) {
      throw new ApiError(
        500,
        'INTERNAL_ERROR',
        'Failed to load financial metric observation history.'
      )
    }

    const page = (data ?? []) as FinancialMetricObservation[]
    rows.push(...page)

    if (requestedLimit !== 'all' || page.length < pageSize) break
    offset += pageSize
  }

  return rows
    .map(mapObservationRowToMetric)
    .reverse()
}
