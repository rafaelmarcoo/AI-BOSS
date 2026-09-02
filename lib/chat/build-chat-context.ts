import { SystemMessage, type BaseMessage } from '@langchain/core/messages'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import { listFinancialMetricObservationsForDocuments } from '@/lib/financial-data/persistence'
import { isAvailableMetric } from '@/lib/financial-data/metrics'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import type {
  FinancialMetricValue,
  AvailableFinancialMetricValue,
} from '@/lib/financial-data/types'
import {
  retrieveRelevantDocumentChunks,
  type RetrievedDocumentChunk,
} from '@/lib/documents/retrieval'
import { listConfirmedDocumentExcludedCandidates } from '@/lib/documents/extraction-review-persistence'
import type {
  DocumentExtractionCandidate,
  FinancialMetricObservation,
} from '@/types/database'

const RETRIEVED_CHUNK_LIMIT = 5
const CONFIRMED_DOCUMENT_OBSERVATION_LIMIT = 200

function reviewStatusLabel(status: RetrievedDocumentChunk['financialReviewStatus']) {
  switch (status) {
    case 'pending':
      return 'Unreviewed'
    case 'confirmed':
      return 'Review completed; chunk values are original evidence'
    case 'legacy':
      return 'Legacy; review recommended'
    case 'not_required':
      return 'No metric review required'
  }
}

export interface ChatContextBuildResult {
  messages: BaseMessage[]
  metricKeys: string[]
  retrievedChunks: Pick<
    RetrievedDocumentChunk,
    | 'id'
    | 'documentId'
    | 'documentName'
    | 'chunkIndex'
    | 'financialReviewStatus'
  >[]
  hasUnreviewedDocumentEvidence: boolean
}

function formatDateRange(metric: AvailableFinancialMetricValue) {
  if (metric.periodStart && metric.periodEnd) {
    return `period ${metric.periodStart} to ${metric.periodEnd}`
  }

  if (metric.asOfDate) {
    return `as of ${metric.asOfDate}`
  }

  return 'date not provided'
}

function formatAvailableMetric(metric: AvailableFinancialMetricValue) {
  const currency = metric.currency ? ` ${metric.currency}` : ''
  const evidence = metric.provenance.evidence
  const evidenceParts = [
    evidence?.documentId ? `documentId=${evidence.documentId}` : null,
    evidence?.documentChunkId ? `chunkId=${evidence.documentChunkId}` : null,
    evidence?.sourceRowStart ? `row=${evidence.sourceRowStart}` : null,
    evidence?.sourcePage ? `page=${evidence.sourcePage}` : null,
  ].filter(Boolean)

  return [
    `- ${metric.key}: ${metric.value}${currency}`,
    `(${formatDateRange(metric)}`,
    `source=${metric.provenance.sourceType}:${metric.provenance.sourceLabel}`,
    `confidence=${metric.confidence}`,
    evidenceParts.length > 0 ? `evidence ${evidenceParts.join(', ')}` : null,
    `updated=${metric.updatedAt})`,
  ]
    .filter(Boolean)
    .join('; ')
}

function formatMetric(metric: FinancialMetricValue) {
  if (isAvailableMetric(metric)) {
    return formatAvailableMetric(metric)
  }

  return [
    `- ${metric.key}: unavailable`,
    `(reason=${metric.reason}`,
    metric.sourceType ? `source=${metric.sourceType}:${metric.sourceLabel}` : null,
    metric.detail ? `detail=${metric.detail}` : null,
    metric.updatedAt ? `updated=${metric.updatedAt}` : null,
    ')',
  ]
    .filter(Boolean)
    .join('; ')
}

function buildMetricsContextBlock(
  result: Awaited<ReturnType<typeof readSourceAwareMetrics>>
) {
  const metrics = FINANCIAL_METRIC_KEYS.map((key) =>
    formatMetric(result.metrics[key])
  ).join('\n')

  const runwayInput = result.runwayInput
    ? `Working-capital-adjusted runway inputs available: cash=${result.runwayInput.cash}; accounts_receivable=${result.runwayInput.ar}; accounts_payable=${result.runwayInput.ap}; burn_rate=${result.runwayInput.burn}.`
    : 'Working-capital-adjusted runway inputs are incomplete.'
  const adjustedRunway = formatMetric(result.workingCapitalAdjustedRunway)

  return `Structured financial metrics from financial_metric_observations:
Available metrics: ${result.availableMetricCount}; unavailable metrics: ${result.unavailableMetricCount}.
${runwayInput}
Working-capital-adjusted runway view:
${adjustedRunway}
${metrics}`
}

function buildDocumentContextBlock(chunks: RetrievedDocumentChunk[]) {
  if (chunks.length === 0) {
    return 'Retrieved document context: no relevant embedded document chunks were found.'
  }

  const formattedChunks = chunks
    .map((chunk, index) => {
      const location = chunk.sourcePage
        ? `page ${chunk.sourcePage}`
        : `chunk ${chunk.chunkIndex}`

      return [
        `[${index + 1}] ${chunk.documentName} (${chunk.documentType}; review_status=${reviewStatusLabel(chunk.financialReviewStatus)}; ${location}; similarity=${chunk.similarity.toFixed(3)}; documentId=${chunk.documentId}; chunkId=${chunk.id})`,
        chunk.content,
      ].join('\n')
    })
    .join('\n\n')

  return `Retrieved original document context from uploaded documents:
Every chunk below is immutable original-file evidence. A confirmed document's chunk can still contain a value that the user later corrected or excluded, so never describe a raw chunk value as User-confirmed. Chunks marked review_status=Unreviewed may be quoted exactly with an unreviewed label, but you must not derive differences, totals, averages, percentages, trends, forecasts, runway, or any other calculated result from them. Tell the user to review and confirm the document before calculations can use those values. For confirmed documents, use the separate User-confirmed observation context or financial tools as current truth. Never expose internal database status tokens.
${formattedChunks}`
}

function observationDate(row: FinancialMetricObservation) {
  return row.as_of_date ?? row.period_end ?? row.period_start ?? 'date not provided'
}

function buildConfirmedDocumentObservationContextBlock(
  rows: FinancialMetricObservation[],
  documentNames: Map<string, string>
) {
  if (rows.length === 0) {
    return `User-confirmed document observations: none are currently published for the retrieved confirmed documents. Do not treat values found only in original chunks as approved calculation values.`
  }

  const observations = [...rows]
    .sort((left, right) => {
      const documentComparison = left.source_label.localeCompare(right.source_label)
      if (documentComparison !== 0) return documentComparison

      const metricComparison = left.metric_key.localeCompare(right.metric_key)
      if (metricComparison !== 0) return metricComparison

      return observationDate(left).localeCompare(observationDate(right))
    })
    .map((row) => {
      const currency = row.currency ? ` ${row.currency}` : ''
      const documentName = row.document_id
        ? documentNames.get(row.document_id) ?? row.source_label
        : row.source_label

      return `- ${documentName}: ${row.metric_key}=${row.value}${currency}; reporting_date=${observationDate(row)}; documentId=${row.document_id ?? 'not provided'}`
    })
    .join('\n')

  return `User-confirmed document observations from financial_metric_observations:
These are the approved current and historical values for the retrieved confirmed documents. They override conflicting values in immutable original chunks. Corrections appear here with their corrected values. Excluded candidates do not appear here and must not be presented as approved values.
${observations}`
}

function buildExcludedDocumentCandidateContextBlock(
  candidates: DocumentExtractionCandidate[],
  documentNames: Map<string, string>
) {
  if (candidates.length === 0) return null

  const exclusions = candidates
    .map((candidate) => {
      const documentName =
        documentNames.get(candidate.document_id) ?? candidate.document_id
      const metric = candidate.metric_key ?? 'unmapped metric'
      const value = candidate.value === null ? 'not provided' : candidate.value
      const currency = candidate.currency ? ` ${candidate.currency}` : ''
      const reportingDate = candidate.reporting_date ?? 'date not provided'

      return `- ${documentName}: ${metric}=${value}${currency}; reporting_date=${reportingDate}; decision=Explicitly excluded by user; candidateId=${candidate.id}`
    })
    .join('\n')

  return `Confirmed document-review exclusions:
The following extracted candidates were explicitly excluded by the user. They remain original/audit evidence but are not User-confirmed financial values and must not be used in calculations. If asked about one, say it was explicitly excluded during review; do not say it is pending, unreviewed, or still needs confirmation.
${exclusions}`
}

function queryTargetsUnreviewedDocument(
  query: string,
  chunks: RetrievedDocumentChunk[]
) {
  const normalizedQuery = query.toLowerCase()
  const pendingChunks = chunks.filter(
    (chunk) => chunk.financialReviewStatus === 'pending'
  )

  if (pendingChunks.length === 0) return false

  const namesPendingDocument = pendingChunks.some((chunk) =>
    normalizedQuery.includes(chunk.documentName.toLowerCase())
  )
  const asksAboutDocumentEvidence =
    /\b(document|file|csv|xlsx|pdf|upload|uploaded)\b/.test(normalizedQuery)

  return namesPendingDocument || asksAboutDocumentEvidence
}

export async function buildChatContext(params: {
  userId: string
  query: string
}): Promise<ChatContextBuildResult> {
  const messages: BaseMessage[] = []
  const metricKeys: string[] = []
  let retrievedChunks: RetrievedDocumentChunk[] = []

  try {
    const metrics = await readSourceAwareMetrics(params.userId)
    metricKeys.push(...FINANCIAL_METRIC_KEYS)
    messages.push(new SystemMessage(buildMetricsContextBlock(metrics)))
  } catch {
    messages.push(
      new SystemMessage(
        'Structured financial metrics from financial_metric_observations are unavailable because the metrics read failed. Do not invent metric values.'
      )
    )
  }

  try {
    retrievedChunks = await retrieveRelevantDocumentChunks({
      userId: params.userId,
      query: params.query,
      limit: RETRIEVED_CHUNK_LIMIT,
    })
    messages.push(new SystemMessage(buildDocumentContextBlock(retrievedChunks)))

    const confirmedDocuments = new Map(
      retrievedChunks
        .filter((chunk) => chunk.financialReviewStatus === 'confirmed')
        .map((chunk) => [chunk.documentId, chunk.documentName])
    )

    if (confirmedDocuments.size > 0) {
      try {
        const observations = await listFinancialMetricObservationsForDocuments({
          userId: params.userId,
          documentIds: [...confirmedDocuments.keys()],
          limit: CONFIRMED_DOCUMENT_OBSERVATION_LIMIT,
        })
        messages.push(
          new SystemMessage(
            buildConfirmedDocumentObservationContextBlock(
              observations,
              confirmedDocuments
            )
          )
        )
      } catch {
        messages.push(
          new SystemMessage(
            `User-confirmed observation history for the retrieved documents could not be loaded. Do not present values found only in immutable original chunks as approved or User-confirmed. Use financial tools for current calculation truth.`
          )
        )
      }

      try {
        const excludedCandidates =
          await listConfirmedDocumentExcludedCandidates({
            userId: params.userId,
            documentIds: [...confirmedDocuments.keys()],
            limit: CONFIRMED_DOCUMENT_OBSERVATION_LIMIT,
          })
        const exclusionContext = buildExcludedDocumentCandidateContextBlock(
          excludedCandidates,
          confirmedDocuments
        )
        if (exclusionContext) {
          messages.push(new SystemMessage(exclusionContext))
        }
      } catch {
        messages.push(
          new SystemMessage(
            `Confirmed document exclusion decisions could not be loaded. Do not infer that a value missing from User-confirmed observations is merely pending or still needs confirmation.`
          )
        )
      }
    }
  } catch {
    messages.push(
      new SystemMessage(
        'Retrieved document context is unavailable because document retrieval failed. Answer from structured metrics and conversation context only.'
      )
    )
  }

  return {
    messages,
    metricKeys,
    hasUnreviewedDocumentEvidence: queryTargetsUnreviewedDocument(
      params.query,
      retrievedChunks
    ),
    retrievedChunks: retrievedChunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
      financialReviewStatus: chunk.financialReviewStatus,
    })),
  }
}
