import { ApiError } from '@/lib/api/errors'
import type { DocumentExtractionCandidateDraft } from '@/lib/documents/types'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { DocumentExtractionRun } from '@/types/database'

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
