import { buildChatContext } from '@/lib/chat/build-chat-context'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { listFinancialMetricObservationsForDocuments } from '@/lib/financial-data/persistence'
import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import { retrieveRelevantDocumentChunks } from '@/lib/documents/retrieval'
import { listConfirmedDocumentExcludedCandidates } from '@/lib/documents/extraction-review-persistence'
import type { FinancialMetricSet } from '@/lib/financial-data/types'

jest.mock('@/lib/financial-data/read-service', () => ({
  readSourceAwareMetrics: jest.fn(),
}))

jest.mock('@/lib/financial-data/persistence', () => ({
  listFinancialMetricObservationsForDocuments: jest.fn(),
}))

jest.mock('@/lib/documents/retrieval', () => ({
  retrieveRelevantDocumentChunks: jest.fn(),
}))

jest.mock('@/lib/documents/extraction-review-persistence', () => ({
  listConfirmedDocumentExcludedCandidates: jest.fn(),
}))

const mockReadSourceAwareMetrics = jest.mocked(readSourceAwareMetrics)
const mockListFinancialMetricObservationsForDocuments = jest.mocked(
  listFinancialMetricObservationsForDocuments
)
const mockRetrieveRelevantDocumentChunks = jest.mocked(
  retrieveRelevantDocumentChunks
)
const mockListConfirmedDocumentExcludedCandidates = jest.mocked(
  listConfirmedDocumentExcludedCandidates
)

function messageText(index: number, messages: Awaited<ReturnType<typeof buildChatContext>>['messages']) {
  return String(messages[index].content)
}

function buildMetrics(overrides: FinancialMetricSet = {}) {
  const metrics = fillUnavailableMetrics({
    cash: {
      status: 'available',
      key: 'cash',
      value: 120000,
      currency: 'NZD',
      periodStart: null,
      periodEnd: null,
      asOfDate: '2026-05-12',
      provenance: {
        sourceType: 'document',
        sourceLabel: 'summary.csv',
        evidence: {
          documentId: 'document-1',
          documentChunkId: 'chunk-1',
          sourceRowStart: 2,
        },
      },
      confidence: 0.95,
      updatedAt: '2026-05-12T00:00:00.000Z',
    },
    ...overrides,
  })

  return {
    metrics,
    availableMetricCount: Object.values(metrics).filter(
      (metric) => metric.status === 'available'
    ).length,
    unavailableMetricCount: Object.values(metrics).filter(
      (metric) => metric.status === 'unavailable'
    ).length,
    runwayInput: null,
    workingCapitalAdjustedRunway: metrics.runway_months,
  }
}

describe('buildChatContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListFinancialMetricObservationsForDocuments.mockResolvedValue([])
    mockListConfirmedDocumentExcludedCandidates.mockResolvedValue([])
  })

  it('includes source-aware metric context for the agent', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(buildMetrics())
    mockRetrieveRelevantDocumentChunks.mockResolvedValue([])

    const result = await buildChatContext({
      userId: 'user-123',
      query: 'What is my cash position?',
    })

    expect(messageText(0, result.messages)).toContain(
      'Structured financial metrics from financial_metric_observations'
    )
    expect(messageText(0, result.messages)).toContain('cash: 120000 NZD')
    expect(messageText(0, result.messages)).toContain('source=document:summary.csv')
    expect(messageText(0, result.messages)).toContain('chunkId=chunk-1')
    expect(mockReadSourceAwareMetrics).toHaveBeenCalledWith('user-123')
  })

  it('includes retrieved document context for the agent', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(buildMetrics())
    mockRetrieveRelevantDocumentChunks.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        documentName: 'summary.csv',
        documentType: 'csv',
        financialReviewStatus: 'pending',
        chunkIndex: 0,
        content: 'Runway months,5.4,,2026-05-12',
        sourcePage: null,
        metadata: { rowStart: 8 },
        similarity: 0.91,
      },
    ])

    const result = await buildChatContext({
      userId: 'user-123',
      query: 'What does summary.csv say about runway?',
    })

    expect(messageText(1, result.messages)).toContain(
      'Retrieved original document context from uploaded documents'
    )
    expect(messageText(1, result.messages)).toContain('summary.csv')
    expect(messageText(1, result.messages)).toContain(
      'Runway months,5.4,,2026-05-12'
    )
    expect(messageText(1, result.messages)).toContain(
      'review_status=Unreviewed'
    )
    expect(messageText(1, result.messages)).not.toContain('review=pending')
    expect(messageText(1, result.messages)).toContain(
      'must not derive differences, totals, averages, percentages, trends, forecasts, runway'
    )
    expect(result.hasUnreviewedDocumentEvidence).toBe(true)
    expect(mockRetrieveRelevantDocumentChunks).toHaveBeenCalledWith({
      userId: 'user-123',
      query: 'What does summary.csv say about runway?',
      limit: 5,
    })

    const unrelatedQuestion = await buildChatContext({
      userId: 'user-123',
      query: 'What is my runway?',
    })
    expect(unrelatedQuestion.hasUnreviewedDocumentEvidence).toBe(false)
  })

  it('keeps chat usable when retrieval fails', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(buildMetrics())
    mockRetrieveRelevantDocumentChunks.mockRejectedValue(
      new Error('OPENAI_API_KEY missing')
    )

    const result = await buildChatContext({
      userId: 'user-123',
      query: 'What is my runway?',
    })

    expect(result.messages).toHaveLength(2)
    expect(messageText(0, result.messages)).toContain('cash: 120000 NZD')
    expect(messageText(1, result.messages)).toContain(
      'Retrieved document context is unavailable'
    )
  })

  it('uses corrected confirmed observations instead of conflicting original chunks', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(buildMetrics())
    mockRetrieveRelevantDocumentChunks.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        documentName: 'summary.csv',
        documentType: 'csv',
        financialReviewStatus: 'confirmed',
        chunkIndex: 0,
        content:
          'Cash,80000,NZD,2026-05-31\nAccounts receivable,18000,NZD,2026-05-31',
        sourcePage: null,
        metadata: { rowStart: 2 },
        similarity: 0.91,
      },
    ])
    mockListFinancialMetricObservationsForDocuments.mockResolvedValue([
      {
        id: 'observation-march',
        user_id: 'user-123',
        connection_id: null,
        document_id: 'document-1',
        metric_key: 'cash',
        value: 100000,
        currency: 'NZD',
        period_start: null,
        period_end: null,
        as_of_date: '2026-03-31',
        source_type: 'document',
        source_label: 'summary.csv',
        confidence: 0.95,
        evidence: { sourceRowStart: 2 },
        raw_data: {},
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'observation-april',
        user_id: 'user-123',
        connection_id: null,
        document_id: 'document-1',
        metric_key: 'cash',
        value: 90000,
        currency: 'NZD',
        period_start: null,
        period_end: null,
        as_of_date: '2026-04-30',
        source_type: 'document',
        source_label: 'summary.csv',
        confidence: 0.95,
        evidence: { sourceRowStart: 3 },
        raw_data: {},
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 'observation-may',
        user_id: 'user-123',
        connection_id: null,
        document_id: 'document-1',
        metric_key: 'cash',
        value: 100000,
        currency: 'NZD',
        period_start: null,
        period_end: null,
        as_of_date: '2026-05-31',
        source_type: 'document',
        source_label: 'summary.csv',
        confidence: 0.95,
        evidence: { sourceRowStart: 2 },
        raw_data: {},
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ])
    mockListConfirmedDocumentExcludedCandidates.mockResolvedValue([
      {
        id: 'candidate-receivables-may',
        extraction_run_id: 'run-1',
        document_id: 'document-1',
        user_id: 'user-123',
        original_payload: { value: 16000 },
        reviewed_payload: { value: 16000, decision: 'excluded' },
        metric_key: 'accounts_receivable',
        value: 16000,
        currency: 'NZD',
        reporting_date: '2026-05-31',
        confidence: 0.95,
        evidence: { sourceRowStart: 4 },
        warnings: [],
        decision: 'excluded',
        extractor_version: 'deterministic_csv_v2',
        reviewer_id: 'user-123',
        reviewed_at: '2026-06-01T00:00:00.000Z',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ])

    const result = await buildChatContext({
      userId: 'user-123',
      query: 'What does summary.csv say about cash?',
    })

    expect(messageText(1, result.messages)).toContain(
      'review_status=Review completed; chunk values are original evidence'
    )
    expect(messageText(1, result.messages)).toContain(
      'immutable original-file evidence'
    )
    expect(messageText(1, result.messages)).not.toContain('review=confirmed')
    expect(messageText(2, result.messages)).toContain(
      'User-confirmed document observations from financial_metric_observations'
    )
    expect(messageText(2, result.messages)).toContain(
      'cash=100000 NZD; reporting_date=2026-03-31'
    )
    expect(messageText(2, result.messages)).toContain(
      'cash=90000 NZD; reporting_date=2026-04-30'
    )
    expect(messageText(2, result.messages)).toContain(
      'cash=100000 NZD; reporting_date=2026-05-31'
    )
    expect(messageText(2, result.messages)).toContain(
      'override conflicting values in immutable original chunks'
    )
    expect(messageText(2, result.messages)).not.toContain('cash=80000')
    expect(messageText(2, result.messages)).not.toContain(
      'accounts_receivable'
    )
    expect(messageText(3, result.messages)).toContain(
      'Confirmed document-review exclusions'
    )
    expect(messageText(3, result.messages)).toContain(
      'accounts_receivable=16000 NZD; reporting_date=2026-05-31; decision=Explicitly excluded by user'
    )
    expect(messageText(3, result.messages)).toContain(
      'do not say it is pending, unreviewed, or still needs confirmation'
    )
    expect(mockListFinancialMetricObservationsForDocuments).toHaveBeenCalledWith({
      userId: 'user-123',
      documentIds: ['document-1'],
      limit: 200,
    })
    expect(mockListConfirmedDocumentExcludedCandidates).toHaveBeenCalledWith({
      userId: 'user-123',
      documentIds: ['document-1'],
      limit: 200,
    })
    expect(result.hasUnreviewedDocumentEvidence).toBe(false)
  })

  it('represents unavailable metrics clearly', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(buildMetrics())
    mockRetrieveRelevantDocumentChunks.mockResolvedValue([])

    const result = await buildChatContext({
      userId: 'user-123',
      query: 'What are my expenses?',
    })

    expect(messageText(0, result.messages)).toContain(
      'monthly_expenses: unavailable'
    )
    expect(messageText(0, result.messages)).toContain('reason=not_provided')
  })
})
