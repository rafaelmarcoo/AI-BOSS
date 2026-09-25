import { ApiError } from '@/lib/api/errors'
import {
  FinancialAnalysisResultSchema,
  PersistedFinancialAnalysisResultSchema,
  normalizeFinancialAnalysisResult,
  type FinancialAnalysisResult,
  type FinancialAnalysisSelectionMode,
} from '@/lib/financial-analysis/types'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { FinancialAnalysisRun } from '@/types/database'

const FINANCIAL_ANALYSIS_RUN_SELECT = `
  id,
  user_id,
  selected_source_key,
  selected_source_label,
  selected_currency,
  selection_mode,
  selected_sources,
  reporting_period_start,
  reporting_period_end,
  run_status,
  data_readiness,
  baseline_fingerprint,
  result_payload,
  agent_trace,
  policy_version,
  model_metadata,
  token_metadata,
  created_at
`

const FINANCIAL_ANALYSIS_RUN_VIEW_SELECT = `
  id,
  selected_source_key,
  selected_source_label,
  selected_currency,
  selection_mode,
  selected_sources,
  reporting_period_start,
  reporting_period_end,
  run_status,
  data_readiness,
  result_payload,
  created_at
`

const FINANCIAL_ANALYSIS_RUN_SUMMARY_SELECT = `
  id,
  selected_source_key,
  selected_source_label,
  selected_currency,
  selection_mode,
  selected_sources,
  reporting_period_start,
  reporting_period_end,
  run_status,
  data_readiness,
  created_at
`

export interface FinancialAnalysisRunSummary {
  id: string
  selectedSourceKey: string
  selectedSourceLabel: string
  selectedCurrency: 'NZD' | 'AUD'
  selectionMode: FinancialAnalysisSelectionMode
  selectedSources: Array<{ sourceKey: string; sourceLabel: string }>
  reportingPeriodStart: string
  reportingPeriodEnd: string
  runStatus: FinancialAnalysisRun['run_status']
  dataReadiness: FinancialAnalysisRun['data_readiness']
  createdAt: string
}

export interface FinancialAnalysisRunView extends FinancialAnalysisRunSummary {
  result: FinancialAnalysisResult
}

interface FinancialAnalysisRunViewRow {
  id: string
  selected_source_key: string
  selected_source_label: string
  selected_currency: 'NZD' | 'AUD'
  selection_mode?: FinancialAnalysisSelectionMode
  selected_sources?: unknown
  reporting_period_start?: string
  reporting_period_end?: string
  run_status: FinancialAnalysisRun['run_status']
  data_readiness: FinancialAnalysisRun['data_readiness']
  result_payload?: unknown
  created_at: string
}

function selectedSourceSummaries(row: FinancialAnalysisRunViewRow) {
  if (Array.isArray(row.selected_sources)) {
    const sources = row.selected_sources.flatMap((source) => {
      if (
        typeof source === 'object' &&
        source !== null &&
        'sourceKey' in source &&
        typeof source.sourceKey === 'string' &&
        'sourceLabel' in source &&
        typeof source.sourceLabel === 'string'
      ) {
        return [{
          sourceKey: source.sourceKey,
          sourceLabel: source.sourceLabel,
        }]
      }
      return []
    })
    if (sources.length > 0) return sources
  }

  return [{
    sourceKey: row.selected_source_key,
    sourceLabel: row.selected_source_label,
  }]
}

function toSummary(row: FinancialAnalysisRunViewRow): FinancialAnalysisRunSummary {
  return {
    id: row.id,
    selectedSourceKey: row.selected_source_key,
    selectedSourceLabel: row.selected_source_label,
    selectedCurrency: row.selected_currency,
    selectionMode: row.selection_mode ?? 'single',
    selectedSources: selectedSourceSummaries(row),
    reportingPeriodStart: row.reporting_period_start ?? row.created_at.slice(0, 10),
    reportingPeriodEnd: row.reporting_period_end ?? row.created_at.slice(0, 10),
    runStatus: row.run_status,
    dataReadiness: row.data_readiness,
    createdAt: row.created_at,
  }
}

function toView(row: FinancialAnalysisRunViewRow): FinancialAnalysisRunView {
  const parsed = PersistedFinancialAnalysisResultSchema.safeParse(row.result_payload)
  if (!parsed.success) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'The saved financial analysis report is invalid.'
    )
  }

  return { ...toSummary(row), result: normalizeFinancialAnalysisResult(parsed.data) }
}

export async function saveFinancialAnalysisRun(params: {
  userId: string
  result: FinancialAnalysisResult
  baselineFingerprint: Array<{ id: string; updatedAt: string }>
  modelMetadata: Record<string, unknown>
  tokenMetadata: Record<string, unknown>
}) {
  const result = FinancialAnalysisResultSchema.parse(params.result)
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_analysis_runs')
    .insert({
      user_id: params.userId,
      selected_source_key: result.selectedBaseline.sourceKey,
      selected_source_label: result.selectedBaseline.sourceLabel,
      selected_currency: result.selectedBaseline.currency,
      selection_mode: result.selectedBaseline.mode,
      selected_sources: result.selectedBaseline.sources,
      reporting_period_start: result.selectedBaseline.reportingPeriodStart,
      reporting_period_end: result.selectedBaseline.reportingPeriodEnd,
      run_status: result.runStatus,
      data_readiness: result.readiness.status,
      baseline_fingerprint: params.baselineFingerprint,
      result_payload: result,
      agent_trace: result.agentTrace,
      policy_version: result.policy.policyVersion,
      model_metadata: params.modelMetadata,
      token_metadata: params.tokenMetadata,
    })
    .select(FINANCIAL_ANALYSIS_RUN_SELECT)
    .single()

  if (error || !data) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to save the financial analysis report.'
    )
  }

  return data as FinancialAnalysisRun
}

export async function listFinancialAnalysisRuns(
  userId: string
): Promise<FinancialAnalysisRunSummary[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_analysis_runs')
    .select(FINANCIAL_ANALYSIS_RUN_SUMMARY_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load financial analysis reports.'
    )
  }

  return (data ?? []).map((row) => toSummary(row as FinancialAnalysisRunViewRow))
}

export async function getFinancialAnalysisRun(
  analysisRunId: string,
  userId: string
): Promise<FinancialAnalysisRunView> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_analysis_runs')
    .select(FINANCIAL_ANALYSIS_RUN_VIEW_SELECT)
    .eq('id', analysisRunId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new ApiError(404, 'NOT_FOUND', 'Financial analysis report not found.')
  }

  return toView(data as FinancialAnalysisRunViewRow)
}

export async function deleteFinancialAnalysisRun(
  analysisRunId: string,
  userId: string
) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('financial_analysis_runs')
    .delete()
    .eq('id', analysisRunId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error?.code === '23503') {
    throw new ApiError(
      409,
      'CONFLICT',
      'This report has protected decision-test records and cannot be deleted.'
    )
  }
  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to delete the financial analysis report.'
    )
  }
  if (!data) {
    throw new ApiError(404, 'NOT_FOUND', 'Financial analysis report not found.')
  }

  return { deleted: true as const }
}

export function toFinancialAnalysisRunView(
  run: FinancialAnalysisRun
): FinancialAnalysisRunView {
  return toView(run)
}
