import { isFinancialMetricKey } from '@/lib/financial-data'
import type {
  ReviewedDocumentCandidateInput,
} from '@/lib/documents/types'
import type { ValidationResult } from '@/lib/api/validation'

const MAX_WORKSHEET_SELECTIONS = 25

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export interface ReprocessDocumentPayload {
  selectedWorksheetNames?: string[]
}

export function validateReprocessDocumentPayload(
  payload: unknown
): ValidationResult<ReprocessDocumentPayload> {
  const details: Record<string, string> = {}
  const input = isObject(payload) ? payload : {}
  const rawNames = input.selectedWorksheetNames

  if (rawNames === undefined) return { success: true, data: {} }

  if (!Array.isArray(rawNames)) {
    return {
      success: false,
      details: {
        selectedWorksheetNames: 'selectedWorksheetNames must be an array.',
      },
    }
  }

  const names = rawNames.flatMap((name, index) => {
    if (typeof name !== 'string' || !name.trim()) {
      details[`selectedWorksheetNames.${index}`] =
        'Worksheet names must be non-empty strings.'
      return []
    }
    return [name.trim()]
  })

  if (names.length > MAX_WORKSHEET_SELECTIONS) {
    details.selectedWorksheetNames = `Select at most ${MAX_WORKSHEET_SELECTIONS} worksheets.`
  }

  if (new Set(names).size !== names.length) {
    details.selectedWorksheetNames = 'Worksheet names must not be duplicated.'
  }

  if (Object.keys(details).length > 0) {
    return { success: false, details }
  }

  return {
    success: true,
    data: { selectedWorksheetNames: names },
  }
}

export interface ConfirmDocumentPayload {
  extractionRunId: string
  candidates: ReviewedDocumentCandidateInput[]
}

export function validateConfirmDocumentPayload(
  payload: unknown
): ValidationResult<ConfirmDocumentPayload> {
  const details: Record<string, string> = {}
  const input = isObject(payload) ? payload : {}
  const extractionRunId = input.extractionRunId
  const rawCandidates = input.candidates

  if (typeof extractionRunId !== 'string' || !extractionRunId.trim()) {
    details.extractionRunId = 'extractionRunId is required.'
  }

  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    details.candidates = 'candidates must contain every extracted candidate.'
    return { success: false, details }
  }

  const candidates = rawCandidates.flatMap((rawCandidate, index) => {
    const field = (name: string) => `candidates.${index}.${name}`

    if (!isObject(rawCandidate)) {
      details[`candidates.${index}`] = 'Each candidate review must be an object.'
      return []
    }

    const candidateId = rawCandidate.candidateId
    const decision = rawCandidate.decision
    const metricKey = rawCandidate.metricKey ?? null
    const value = rawCandidate.value ?? null
    const currency = rawCandidate.currency ?? null
    const reportingDate = rawCandidate.reportingDate ?? null

    if (typeof candidateId !== 'string' || !candidateId.trim()) {
      details[field('candidateId')] = 'candidateId is required.'
    }
    if (decision !== 'included' && decision !== 'excluded') {
      details[field('decision')] = 'decision must be included or excluded.'
    }
    if (metricKey !== null && (typeof metricKey !== 'string' || !isFinancialMetricKey(metricKey))) {
      details[field('metricKey')] = 'metricKey is not supported.'
    }
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      details[field('value')] = 'value must be a finite number.'
    }
    if (currency !== null && currency !== 'NZD' && currency !== 'AUD') {
      details[field('currency')] = 'currency must be NZD or AUD.'
    }
    if (
      reportingDate !== null &&
      (typeof reportingDate !== 'string' || !isIsoDate(reportingDate))
    ) {
      details[field('reportingDate')] =
        'reportingDate must be a valid YYYY-MM-DD date.'
    }

    if (decision === 'included') {
      if (typeof metricKey !== 'string' || !isFinancialMetricKey(metricKey)) {
        details[field('metricKey')] = 'Included candidates require a metric.'
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        details[field('value')] = 'Included candidates require a value.'
      }
      if (currency !== 'NZD' && currency !== 'AUD') {
        details[field('currency')] =
          'Included candidates require NZD or AUD currency.'
      }
      if (typeof reportingDate !== 'string' || !isIsoDate(reportingDate)) {
        details[field('reportingDate')] =
          'Included candidates require a valid reporting date.'
      }
    }

    if (
      typeof candidateId !== 'string' ||
      !candidateId.trim() ||
      (decision !== 'included' && decision !== 'excluded')
    ) {
      return []
    }

    return [{
      candidateId: candidateId.trim(),
      decision,
      metricKey:
        typeof metricKey === 'string' && isFinancialMetricKey(metricKey)
          ? metricKey
          : null,
      value: typeof value === 'number' && Number.isFinite(value) ? value : null,
      currency: currency === 'NZD' || currency === 'AUD' ? currency : null,
      reportingDate:
        typeof reportingDate === 'string' && isIsoDate(reportingDate)
          ? reportingDate
          : null,
    } satisfies ReviewedDocumentCandidateInput]
  })

  const candidateIds = candidates.map((candidate) => candidate.candidateId)
  if (new Set(candidateIds).size !== candidateIds.length) {
    details.candidates = 'Each candidate may be reviewed only once.'
  }

  if (
    Object.keys(details).length > 0 ||
    candidates.length !== rawCandidates.length ||
    typeof extractionRunId !== 'string' ||
    !extractionRunId.trim()
  ) {
    return { success: false, details }
  }

  return {
    success: true,
    data: {
      extractionRunId: extractionRunId.trim(),
      candidates,
    },
  }
}
