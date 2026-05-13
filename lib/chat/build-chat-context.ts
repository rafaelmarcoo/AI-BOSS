import { SystemMessage, type BaseMessage } from '@langchain/core/messages'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
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

const RETRIEVED_CHUNK_LIMIT = 5

export interface ChatContextBuildResult {
  messages: BaseMessage[]
  metricKeys: string[]
  retrievedChunks: Pick<
    RetrievedDocumentChunk,
    'id' | 'documentId' | 'documentName' | 'chunkIndex'
  >[]
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
    ? `Runway calculation inputs available: cash=${result.runwayInput.cash}; accounts_receivable=${result.runwayInput.ar}; accounts_payable=${result.runwayInput.ap}; burn_rate=${result.runwayInput.burn}.`
    : 'Runway calculation inputs are incomplete.'

  return `Structured financial metrics from financial_metric_observations:
Available metrics: ${result.availableMetricCount}; unavailable metrics: ${result.unavailableMetricCount}.
${runwayInput}
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
        `[${index + 1}] ${chunk.documentName} (${chunk.documentType}; ${location}; similarity=${chunk.similarity.toFixed(3)}; documentId=${chunk.documentId}; chunkId=${chunk.id})`,
        chunk.content,
      ].join('\n')
    })
    .join('\n\n')

  return `Retrieved document context from uploaded documents:
${formattedChunks}`
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
    retrievedChunks: retrievedChunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
    })),
  }
}
