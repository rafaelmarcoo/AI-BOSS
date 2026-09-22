import { ApiError } from '@/lib/api/errors'
import {
  FinancialAnalysisResultSchema,
  type FinancialAnalysisResult,
} from '@/lib/financial-analysis/types'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { FinancialAnalysisRun } from '@/types/database'

const FINANCIAL_ANALYSIS_RUN_SELECT = `
  id,
  user_id,
  selected_source_key,
  selected_source_label,
  selected_currency,
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
  run_status,
  data_readiness,
  created_at
`

export interface FinancialAnalysisRunSummary {
  id: string
  selectedSourceKey: string
  selectedSourceLabel: string
  selectedCurrency: 'NZD' | 'AUD'
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
  run_status: FinancialAnalysisRun['run_status']
  data_readiness: FinancialAnalysisRun['data_readiness']
  result_payload?: unknown
  created_at: string
}

function toSummary(row: FinancialAnalysisRunViewRow): FinancialAnalysisRunSummary {
  return {
    id: row.id,
    selectedSourceKey: row.selected_source_key,
    selectedSourceLabel: row.selected_source_label,
    selectedCurrency: row.selected_currency,
    runStatus: row.run_status,
    dataReadiness: row.data_readiness,
    createdAt: row.created_at,
  }
}

function toView(row: FinancialAnalysisRunViewRow): FinancialAnalysisRunView {
  const parsed = FinancialAnalysisResultSchema.safeParse(row.result_payload)
  if (!parsed.success) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'The saved financial analysis report is invalid.'
    )
  }

  return { ...toSummary(row), result: parsed.data }
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

export function toFinancialAnalysisRunView(
  run: FinancialAnalysisRun
): FinancialAnalysisRunView {
  return toView(run)
}
