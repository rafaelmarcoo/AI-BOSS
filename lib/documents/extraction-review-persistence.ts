import { ApiError } from '@/lib/api/errors'
import type {
  DocumentExtractionCandidateDraft,
  DocumentReviewCandidate,
  ReviewedDocumentCandidateInput,
} from '@/lib/documents/types'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { DocumentExtractionRun } from '@/types/database'
import type { DocumentExtractionCandidate } from '@/types/database'

const EXTRACTION_RUN_SELECT = `
  id,
  document_id,
  user_id,
  status,
  selected_worksheet_names,
  suggested_worksheet_names,
  worksheet_metadata,
  warnings,
  extractor_version,
  error_message,
  started_at,
  completed_at,
  confirmed_at,
  superseded_at,
  created_at,
  updated_at
`

const EXTRACTION_CANDIDATE_SELECT = `
  id,
  extraction_run_id,
  original_payload,
  reviewed_payload,
  metric_key,
  value,
  currency,
  reporting_date,
  confidence,
  evidence,
  warnings,
  decision,
  extractor_version,
  reviewer_id,
  reviewed_at,
  created_at,
  updated_at
`

const EXCLUDED_EXTRACTION_CANDIDATE_SELECT = `
  id,
  extraction_run_id,
  document_id,
  user_id,
  original_payload,
  reviewed_payload,
  metric_key,
  value,
  currency,
  reporting_date,
  confidence,
  evidence,
  warnings,
  decision,
  extractor_version,
  reviewer_id,
  reviewed_at,
  created_at,
  updated_at
`

export async function listConfirmedDocumentExcludedCandidates(params: {
  userId: string
  documentIds: string[]
  limit?: number
}) {
  const documentIds = [...new Set(params.documentIds)]
  if (documentIds.length === 0) return []

  const supabase = createAdminSupabaseClient()
  const { data: runs, error: runError } = await supabase
    .from('document_extraction_runs')
    .select('id, document_id')
    .eq('user_id', params.userId)
    .eq('status', 'confirmed')
    .in('document_id', documentIds)

  if (runError) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load confirmed document review decisions.'
    )
  }

  const extractionRunIds = (runs ?? []).map((run) => run.id)
  if (extractionRunIds.length === 0) return []

  const { data, error } = await supabase
    .from('document_extraction_candidates')
    .select(EXCLUDED_EXTRACTION_CANDIDATE_SELECT)
    .eq('user_id', params.userId)
    .eq('decision', 'excluded')
    .in('document_id', documentIds)
    .in('extraction_run_id', extractionRunIds)
    .order('reporting_date', { ascending: false, nullsFirst: false })
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .limit(params.limit ?? 200)

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load excluded document review candidates.'
    )
  }

  return (data ?? []) as DocumentExtractionCandidate[]
}

export async function getLatestDocumentExtractionReview(params: {
  documentId: string
  userId: string
}) {
  const supabase = createAdminSupabaseClient()
  const { data: run, error: runError } = await supabase
    .from('document_extraction_runs')
    .select(EXTRACTION_RUN_SELECT)
    .eq('document_id', params.documentId)
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (runError) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load document extraction review.',
      runError.message
    )
  }

  if (!run) {
    return { extractionRun: null, candidates: [] }
  }

  const extractionRun = run as DocumentExtractionRun
  const { data: candidates, error: candidateError } = await supabase
    .from('document_extraction_candidates')
    .select(EXTRACTION_CANDIDATE_SELECT)
    .eq('extraction_run_id', extractionRun.id)
    .eq('document_id', params.documentId)
    .eq('user_id', params.userId)
    .order('created_at', { ascending: true })

  if (candidateError) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to load document extraction candidates.',
      candidateError.message
    )
  }

  return {
    extractionRun,
    candidates: (candidates ?? []) as DocumentReviewCandidate[],
  }
}

export async function confirmDocumentExtraction(params: {
  documentId: string
  userId: string
  extractionRunId: string
  candidates: ReviewedDocumentCandidateInput[]
}) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc('confirm_document_extraction', {
    p_document_id: params.documentId,
    p_user_id: params.userId,
    p_extraction_run_id: params.extractionRunId,
    p_reviewer_id: params.userId,
    p_reviewed_candidates: params.candidates.map((candidate) => ({
      candidate_id: candidate.candidateId,
      decision: candidate.decision,
      metric_key: candidate.metricKey,
      value: candidate.value,
      currency: candidate.currency,
      reporting_date: candidate.reportingDate,
    })),
  })

  if (error || typeof data !== 'number') {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'The document review could not be confirmed.',
      error?.message
    )
  }

  return data
}

export async function createDocumentExtractionRun(params: {
  documentId: string
  userId: string
  extractorVersion: string
}) {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('document_extraction_runs')
    .insert({
      document_id: params.documentId,
      user_id: params.userId,
      status: 'processing',
      extractor_version: params.extractorVersion,
    })
    .select(EXTRACTION_RUN_SELECT)
    .single()

  if (error || !data) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to start document extraction.',
      error?.message
    )
  }

  return data as DocumentExtractionRun
}

export async function saveDocumentExtractionCandidates(params: {
  extractionRunId: string
  documentId: string
  userId: string
  candidates: DocumentExtractionCandidateDraft[]
}) {
  if (params.candidates.length === 0) return []

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('document_extraction_candidates')
    .insert(
      params.candidates.map((candidate) => ({
        extraction_run_id: params.extractionRunId,
        document_id: params.documentId,
        user_id: params.userId,
        original_payload: candidate.originalPayload,
        reviewed_payload: null,
        metric_key: candidate.metricKey,
        value: candidate.value,
        currency: candidate.currency,
        reporting_date: candidate.reportingDate,
        confidence: candidate.confidence,
        evidence: candidate.evidence,
        warnings: candidate.warnings,
        decision: 'pending',
        extractor_version: candidate.extractorVersion,
        reviewer_id: null,
        reviewed_at: null,
      }))
    )
    .select('id')

  if (error || !data) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to save document extraction candidates.',
      error?.message
    )
  }

  return data
}

export async function completeDocumentExtractionRun(params: {
  extractionRunId: string
  documentId: string
  userId: string
  selectedWorksheetNames: string[]
  suggestedWorksheetNames: string[]
  worksheetMetadata: unknown[]
  warnings: unknown[]
}) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('document_extraction_runs')
    .update({
      status: 'extracted',
      selected_worksheet_names: params.selectedWorksheetNames,
      suggested_worksheet_names: params.suggestedWorksheetNames,
      worksheet_metadata: params.worksheetMetadata,
      warnings: params.warnings,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', params.extractionRunId)
    .eq('document_id', params.documentId)
    .eq('user_id', params.userId)

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to complete document extraction.',
      error.message
    )
  }
}

export async function failDocumentExtractionRun(params: {
  extractionRunId: string
  documentId: string
  userId: string
  errorMessage: string
}) {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('document_extraction_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: params.errorMessage,
    })
    .eq('id', params.extractionRunId)
    .eq('document_id', params.documentId)
    .eq('user_id', params.userId)

  if (error) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to record document extraction failure.',
      error.message
    )
  }
}
