import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'
import { SUPPORTED_FINANCIAL_CURRENCIES } from '@/lib/financial-data/currency'
import {
  FINANCIAL_METRIC_KEYS,
  type FinancialMetricKey,
} from '@/lib/financial-data/metric-keys'
import { getFinancialObservationSourceKey } from '@/lib/financial-data/source-key'
import type {
  FinancialAnalysisEvidenceResolution,
  FinancialAnalysisSelectedSource,
} from '@/lib/financial-analysis/types'
import type { FinancialMetricObservation } from '@/types/database'

const LegacyFinancialAnalysisRequestSchema = z.object({
  sourceKey: z.string().trim().min(1).max(300),
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
}).strict()

const VersionedFinancialAnalysisRequestSchema = z.object({
  mode: z.enum(['single', 'timeline']),
  sourceKeys: z.array(z.string().trim().min(1).max(300)).min(1).max(12),
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
  asOfDate: z.string().date().nullable().optional(),
  conflictResolutions: z.record(z.string(), z.string().min(1)).optional(),
}).strict().superRefine((request, context) => {
  if (new Set(request.sourceKeys).size !== request.sourceKeys.length) {
    context.addIssue({
      code: 'custom',
      path: ['sourceKeys'],
      message: 'Selected financial sources must be unique.',
    })
  }
  if (request.mode === 'single' && request.sourceKeys.length !== 1) {
    context.addIssue({
      code: 'custom',
      path: ['sourceKeys'],
      message: 'Single-statement analysis requires exactly one source.',
    })
  }
  if (request.mode === 'timeline' && request.sourceKeys.length < 2) {
    context.addIssue({
      code: 'custom',
      path: ['sourceKeys'],
      message: 'Statement timeline analysis requires between 2 and 12 sources.',
    })
  }
})

export const FinancialAnalysisRequestSchema = z.union([
  LegacyFinancialAnalysisRequestSchema,
  VersionedFinancialAnalysisRequestSchema,
]).transform((request) => 'sourceKey' in request
  ? {
      mode: 'single' as const,
      sourceKeys: [request.sourceKey],
      currency: request.currency,
      asOfDate: null,
      conflictResolutions: {} as Record<string, string>,
    }
  : {
      mode: request.mode,
      sourceKeys: request.sourceKeys,
      currency: request.currency,
      asOfDate: request.asOfDate ?? null,
      conflictResolutions: request.conflictResolutions ?? {},
    }
)

export type FinancialAnalysisRequest = z.infer<
  typeof FinancialAnalysisRequestSchema
>

export const FinancialAnalysisPreviewRequestSchema = z.object({
  mode: z.literal('timeline'),
  sourceKeys: z.array(z.string().trim().min(1).max(300)).min(2).max(12),
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
}).strict().superRefine((request, context) => {
  if (new Set(request.sourceKeys).size !== request.sourceKeys.length) {
    context.addIssue({
      code: 'custom',
      path: ['sourceKeys'],
      message: 'Selected financial sources must be unique.',
    })
  }
})

export type FinancialAnalysisPreviewRequest = z.infer<
  typeof FinancialAnalysisPreviewRequestSchema
>

export interface FinancialAnalysisConflictOption {
  observationId: string
  value: number
  sourceKey: string
  sourceLabel: string
  confidence: number
}

export interface FinancialAnalysisTimelineConflict {
  conflictId: string
  metricKey: FinancialMetricKey
  reportingDate: string
  options: FinancialAnalysisConflictOption[]
}

export interface FinancialAnalysisMetricCoverage {
  reportingDate: string
  metricKeys: FinancialMetricKey[]
  sourceKeys: string[]
}

export interface FinancialAnalysisTimelinePreview {
  mode: 'timeline'
  currency: 'NZD' | 'AUD'
  selectedSources: FinancialAnalysisSelectedSource[]
  reportingDates: string[]
  metricCoverage: FinancialAnalysisMetricCoverage[]
  warnings: string[]
  suggestedLatestDate: string
  conflicts: FinancialAnalysisTimelineConflict[]
}

export interface ResolvedFinancialAnalysisTimeline {
  selectedSources: FinancialAnalysisSelectedSource[]
  reportingDates: string[]
  reportingPeriodStart: string
  reportDate: string
  selectedRows: FinancialMetricObservation[]
  calculationRows: FinancialMetricObservation[]
  evidenceResolutionById: Map<string, {
    usedInCalculations: boolean
    resolution: FinancialAnalysisEvidenceResolution
  }>
  conflicts: FinancialAnalysisTimelineConflict[]
  warnings: string[]
}

export function financialAnalysisEffectiveDate(
  observation: FinancialMetricObservation
) {
  return observation.as_of_date ??
    observation.period_end ??
    observation.updated_at.slice(0, 10)
}

function sixMonthCutoff(reportDate: string) {
  const cutoff = new Date(`${reportDate}T00:00:00.000Z`)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6)
  return cutoff.toISOString().slice(0, 10)
}

function sourceFromRows(
  sourceKey: string,
  rows: FinancialMetricObservation[]
): FinancialAnalysisSelectedSource {
  const first = rows[0]
  return {
    sourceKey,
    sourceLabel: first.source_label,
    sourceType: first.source_type,
    documentId: first.document_id,
    connectionId: first.connection_id,
  }
}

function selectOwnedRows(params: {
  sourceKeys: string[]
  currency: 'NZD' | 'AUD'
  observations: FinancialMetricObservation[]
}) {
  const selectedSources = params.sourceKeys.map((sourceKey) => {
    const ownedRows = params.observations.filter(
      (row) => getFinancialObservationSourceKey(row) === sourceKey
    )
    if (ownedRows.length === 0) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'One or more selected financial sources are unavailable or do not belong to this user.'
      )
    }
    const compatibleRows = ownedRows.filter((row) =>
      row.currency === params.currency && row.metric_key !== 'runway_months'
    )
    if (compatibleRows.length === 0) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `The selected source ${ownedRows[0].source_label} has no ${params.currency} observations.`
      )
    }
    return {
      source: sourceFromRows(sourceKey, compatibleRows),
      rows: compatibleRows,
    }
  })

  return {
    sources: selectedSources.map((item) => item.source),
    rows: selectedSources.flatMap((item) => item.rows),
  }
}

function conflictId(metricKey: FinancialMetricKey, reportingDate: string) {
  return `${metricKey}::${reportingDate}`
}

function groupRows(rows: FinancialMetricObservation[]) {
  const grouped = new Map<string, FinancialMetricObservation[]>()
  for (const row of rows) {
    const key = conflictId(row.metric_key, financialAnalysisEffectiveDate(row))
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
}

function buildConflicts(rows: FinancialMetricObservation[]) {
  return groupRows(rows).flatMap(([id, groupedRows]) => {
    if (new Set(groupedRows.map((row) => row.value)).size <= 1) return []
    const first = groupedRows[0]
    return [{
      conflictId: id,
      metricKey: first.metric_key,
      reportingDate: financialAnalysisEffectiveDate(first),
      options: groupedRows
        .map((row) => ({
          observationId: row.id,
          value: row.value,
          sourceKey: getFinancialObservationSourceKey(row),
          sourceLabel: row.source_label,
          confidence: row.confidence,
        }))
        .sort((left, right) =>
          left.sourceLabel.localeCompare(right.sourceLabel) ||
          left.observationId.localeCompare(right.observationId)
        ),
    }]
  })
}

function coverage(rows: FinancialMetricObservation[]) {
  const dates = [...new Set(rows.map(financialAnalysisEffectiveDate))].sort()
  return dates.map((reportingDate) => {
    const dateRows = rows.filter(
      (row) => financialAnalysisEffectiveDate(row) === reportingDate
    )
    return {
      reportingDate,
      metricKeys: FINANCIAL_METRIC_KEYS.filter((metricKey) =>
        dateRows.some((row) => row.metric_key === metricKey)
      ),
      sourceKeys: [...new Set(dateRows.map(getFinancialObservationSourceKey))].sort(),
    }
  })
}

function previewWarnings(params: {
  selectedRows: FinancialMetricObservation[]
  reportDate: string
  conflicts: FinancialAnalysisTimelineConflict[]
  selectedSources: FinancialAnalysisSelectedSource[]
}) {
  const latestMetricKeys = new Set(
    params.selectedRows
      .filter((row) => financialAnalysisEffectiveDate(row) === params.reportDate)
      .map((row) => row.metric_key)
  )
  const requiredLatestMetrics = [
    'cash',
    'accounts_receivable',
    'accounts_payable',
    'monthly_revenue',
    'monthly_expenses',
    'burn_rate',
  ] as const satisfies readonly FinancialMetricKey[]
  const missingLatest = requiredLatestMetrics.filter(
    (metricKey) => !latestMetricKeys.has(metricKey)
  )
  const identicalDuplicateGroups = groupRows(params.selectedRows).filter(([, rows]) =>
    rows.length > 1 && new Set(rows.map((row) => row.value)).size === 1
  ).length
  const contributingSourceKeys = new Set(
    params.selectedRows.map(getFinancialObservationSourceKey)
  )
  const nonContributingSources = params.selectedSources.filter(
    (source) => !contributingSourceKeys.has(source.sourceKey)
  )

  return [
    ...(missingLatest.length > 0
      ? [`Latest-period gaps: ${missingLatest.join(', ')}.`]
      : []),
    ...(params.conflicts.length > 0
      ? [`${params.conflicts.length} overlapping metric value conflict${params.conflicts.length === 1 ? '' : 's'} require resolution.`]
      : []),
    ...(identicalDuplicateGroups > 0
      ? [`${identicalDuplicateGroups} identical overlapping value group${identicalDuplicateGroups === 1 ? '' : 's'} will be deduplicated while retaining provenance.`]
      : []),
    ...(nonContributingSources.length > 0
      ? [`${nonContributingSources.length} selected source${nonContributingSources.length === 1 ? '' : 's'} fall outside the six-month reporting window.`]
      : []),
  ]
}

function prepareTimeline(params: {
  sourceKeys: string[]
  currency: 'NZD' | 'AUD'
  observations: FinancialMetricObservation[]
}) {
  const selected = selectOwnedRows(params)
  const allReportingDates = [...new Set(
    selected.rows.map(financialAnalysisEffectiveDate)
  )].sort()
  const reportDate = allReportingDates.at(-1)
  if (!reportDate) {
    throw new ApiError(400, 'BAD_REQUEST', 'The selected sources contain no dated financial observations.')
  }
  const cutoff = sixMonthCutoff(reportDate)
  const selectedRows = selected.rows
    .filter((row) => {
      const date = financialAnalysisEffectiveDate(row)
      return date >= cutoff && date <= reportDate
    })
    .sort((left, right) =>
      financialAnalysisEffectiveDate(left).localeCompare(financialAnalysisEffectiveDate(right)) ||
      left.metric_key.localeCompare(right.metric_key) ||
      left.id.localeCompare(right.id)
    )
  const reportingDates = [...new Set(
    selectedRows.map(financialAnalysisEffectiveDate)
  )].sort()
  const conflicts = buildConflicts(selectedRows)
  const warnings = previewWarnings({
    selectedRows,
    reportDate,
    conflicts,
    selectedSources: selected.sources,
  })

  return {
    selectedSources: selected.sources,
    reportingDates,
    reportDate,
    selectedRows,
    conflicts,
    warnings,
  }
}

export function previewFinancialAnalysisTimeline(params: {
  request: FinancialAnalysisPreviewRequest
  observations: FinancialMetricObservation[]
}): FinancialAnalysisTimelinePreview {
  const request = FinancialAnalysisPreviewRequestSchema.parse(params.request)
  const timeline = prepareTimeline({
    sourceKeys: request.sourceKeys,
    currency: request.currency,
    observations: params.observations,
  })
  return {
    mode: 'timeline',
    currency: request.currency,
    selectedSources: timeline.selectedSources,
    reportingDates: timeline.reportingDates,
    metricCoverage: coverage(timeline.selectedRows),
    warnings: timeline.warnings,
    suggestedLatestDate: timeline.reportDate,
    conflicts: timeline.conflicts,
  }
}

export function resolveFinancialAnalysisTimeline(params: {
  request: FinancialAnalysisRequest
  observations: FinancialMetricObservation[]
}): ResolvedFinancialAnalysisTimeline {
  if (params.request.mode !== 'timeline') {
    throw new Error('Timeline resolution requires a timeline request.')
  }
  const timeline = prepareTimeline({
    sourceKeys: params.request.sourceKeys,
    currency: params.request.currency,
    observations: params.observations,
  })
  if (params.request.asOfDate !== timeline.reportDate) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'Review the current timeline preview before generating the report.'
    )
  }

  const conflictIds = new Set(timeline.conflicts.map((conflict) => conflict.conflictId))
  const unknownResolution = Object.keys(params.request.conflictResolutions)
    .find((id) => !conflictIds.has(id))
  if (unknownResolution) {
    throw new ApiError(400, 'BAD_REQUEST', 'A conflict resolution does not belong to this timeline.')
  }

  const calculationRows: FinancialMetricObservation[] = []
  const evidenceResolutionById = new Map<string, {
    usedInCalculations: boolean
    resolution: FinancialAnalysisEvidenceResolution
  }>()

  for (const [id, rows] of groupRows(timeline.selectedRows)) {
    const values = new Set(rows.map((row) => row.value))
    if (values.size === 1) {
      const ordered = [...rows].sort((left, right) =>
        right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)
      )
      calculationRows.push(ordered[0])
      for (const row of rows) {
        evidenceResolutionById.set(row.id, {
          usedInCalculations: true,
          resolution: rows.length > 1 ? 'identical_duplicate' : 'uncontested',
        })
      }
      continue
    }

    const selectedObservationId = params.request.conflictResolutions[id]
    const selectedRow = rows.find((row) => row.id === selectedObservationId)
    if (!selectedRow) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'Resolve every overlapping financial value before generating the report.'
      )
    }
    calculationRows.push(selectedRow)
    for (const row of rows) {
      const selected = row.id === selectedRow.id
      evidenceResolutionById.set(row.id, {
        usedInCalculations: selected,
        resolution: selected ? 'user_selected' : 'excluded_conflict',
      })
    }
  }

  return {
    ...timeline,
    reportingPeriodStart: timeline.reportingDates[0] ?? timeline.reportDate,
    calculationRows: calculationRows.sort((left, right) =>
      financialAnalysisEffectiveDate(left).localeCompare(financialAnalysisEffectiveDate(right)) ||
      left.metric_key.localeCompare(right.metric_key) ||
      left.id.localeCompare(right.id)
    ),
    evidenceResolutionById,
  }
}

export async function previewFinancialAnalysis(params: {
  userId: string
  request: FinancialAnalysisPreviewRequest
}) {
  const { listFinancialMetricObservations } = await import(
    '@/lib/financial-data/persistence'
  )
  return previewFinancialAnalysisTimeline({
    request: params.request,
    observations: await listFinancialMetricObservations(params.userId),
  })
}
