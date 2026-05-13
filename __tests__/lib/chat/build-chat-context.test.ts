import { buildChatContext } from '@/lib/chat/build-chat-context'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import { retrieveRelevantDocumentChunks } from '@/lib/documents/retrieval'
import type { FinancialMetricSet } from '@/lib/financial-data/types'

jest.mock('@/lib/financial-data/read-service', () => ({
  readSourceAwareMetrics: jest.fn(),
}))

jest.mock('@/lib/documents/retrieval', () => ({
  retrieveRelevantDocumentChunks: jest.fn(),
}))

const mockReadSourceAwareMetrics = jest.mocked(readSourceAwareMetrics)
const mockRetrieveRelevantDocumentChunks = jest.mocked(
  retrieveRelevantDocumentChunks
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
  }
}

describe('buildChatContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
        chunkIndex: 0,
        content: 'Runway months,5.4,,2026-05-12',
        sourcePage: null,
        metadata: { rowStart: 8 },
        similarity: 0.91,
      },
    ])

    const result = await buildChatContext({
      userId: 'user-123',
      query: 'What is my runway?',
    })

    expect(messageText(1, result.messages)).toContain(
      'Retrieved document context from uploaded documents'
    )
    expect(messageText(1, result.messages)).toContain('summary.csv')
    expect(messageText(1, result.messages)).toContain(
      'Runway months,5.4,,2026-05-12'
    )
    expect(mockRetrieveRelevantDocumentChunks).toHaveBeenCalledWith({
      userId: 'user-123',
      query: 'What is my runway?',
      limit: 5,
    })
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
