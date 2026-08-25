import { processDocument } from '@/lib/documents/process'
import {
  downloadDocumentFile,
  getDocumentById,
  replaceDocumentChunks,
  updateDocumentRecord,
} from '@/lib/documents/persistence'
import { logDocumentIngestion } from '@/lib/documents/log-document-ingestion'
import {
  deleteFinancialMetricObservationsForDocument,
  saveFinancialMetricObservations,
} from '@/lib/financial-data/persistence'
import { embedDocumentChunks } from '@/lib/documents/embeddings'

jest.mock('@/lib/documents/persistence', () => ({
  deleteDocumentFile: jest.fn(),
  downloadDocumentFile: jest.fn(),
  getDocumentById: jest.fn(),
  replaceDocumentChunks: jest.fn(),
  updateDocumentRecord: jest.fn(),
}))

jest.mock('@/lib/documents/log-document-ingestion', () => ({
  logDocumentIngestion: jest.fn(),
}))

jest.mock('@/lib/financial-data/persistence', () => ({
  deleteFinancialMetricObservationsForDocument: jest.fn(),
  saveFinancialMetricObservations: jest.fn(),
}))

jest.mock('@/lib/documents/embeddings', () => ({
  DOCUMENT_EMBEDDING_MODEL: 'text-embedding-3-small',
  embedDocumentChunks: jest.fn(),
}))

const mockGetDocumentById = jest.mocked(getDocumentById)
const mockDownloadDocumentFile = jest.mocked(downloadDocumentFile)
const mockReplaceDocumentChunks = jest.mocked(replaceDocumentChunks)
const mockUpdateDocumentRecord = jest.mocked(updateDocumentRecord)
const mockLogDocumentIngestion = jest.mocked(logDocumentIngestion)
const mockDeleteFinancialMetricObservationsForDocument = jest.mocked(
  deleteFinancialMetricObservationsForDocument
)
const mockSaveFinancialMetricObservations = jest.mocked(
  saveFinancialMetricObservations
)
const mockEmbedDocumentChunks = jest.mocked(embedDocumentChunks)

describe('processDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReplaceDocumentChunks.mockResolvedValue([])
    mockUpdateDocumentRecord.mockResolvedValue({
      id: 'document-123',
      conversation_id: null,
      file_name: 'summary.csv',
      file_type: 'csv',
      mime_type: 'text/csv',
      storage_path: 'user-123/summary.csv',
      status: 'ready',
      financial_review_status: 'legacy',
      document_type: null,
      metadata: null,
      error_message: null,
      created_at: '2026-05-12T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockLogDocumentIngestion.mockResolvedValue(undefined)
    mockEmbedDocumentChunks.mockImplementation(async (chunks) =>
      chunks.map((chunk) => ({
        ...chunk,
        embedding: [1, 0, 0],
      }))
    )
    mockDeleteFinancialMetricObservationsForDocument.mockResolvedValue(undefined)
    mockSaveFinancialMetricObservations.mockResolvedValue([])
  })

  it('saves extracted CSV financial metric observations', async () => {
    mockGetDocumentById.mockResolvedValue({
      id: 'document-123',
      user_id: 'user-123',
      conversation_id: null,
      file_name: 'summary.csv',
      file_type: 'csv',
      mime_type: 'text/csv',
      storage_path: 'user-123/summary.csv',
      status: 'processing',
      financial_review_status: 'legacy',
      document_type: null,
      raw_text: null,
      metadata: null,
      error_message: null,
      created_at: '2026-05-12T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockDownloadDocumentFile.mockResolvedValue(
      Buffer.from('Account,Amount,Currency,Date\nCash at bank,120000,NZD,2026-05-12')
    )

    await processDocument('document-123', 'user-123')

    expect(mockDeleteFinancialMetricObservationsForDocument).toHaveBeenCalledWith(
      'document-123',
      'user-123'
    )
    expect(mockSaveFinancialMetricObservations).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        documentId: 'document-123',
        metrics: expect.arrayContaining([expect.objectContaining({
          key: 'cash',
          value: 120000,
          currency: 'NZD',
          provenance: expect.objectContaining({
            sourceType: 'document',
            sourceLabel: 'summary.csv',
          }),
        })]),
      })
    )
    expect(mockUpdateDocumentRecord).toHaveBeenCalledWith(
      'document-123',
      'user-123',
      expect.objectContaining({
        status: 'ready',
        metadata: expect.objectContaining({
          headers: ['Account', 'Amount', 'Currency', 'Date'],
          rowCount: 1,
          metricObservationCount: 1,
          embeddingModel: 'text-embedding-3-small',
        }),
      })
    )
    expect(mockReplaceDocumentChunks).toHaveBeenCalledWith(
      'document-123',
      'user-123',
      expect.arrayContaining([
        expect.objectContaining({
          embedding: [1, 0, 0],
        }),
      ])
    )
  })

  it('cleans derived metrics when persistence fails', async () => {
    mockGetDocumentById.mockResolvedValue({
      id: 'document-123', user_id: 'user-123', conversation_id: null,
      file_name: 'summary.csv', file_type: 'csv', mime_type: 'text/csv',
      storage_path: 'user-123/summary.csv', status: 'processing', document_type: null,
      financial_review_status: 'legacy',
      raw_text: null, metadata: null, error_message: null,
      created_at: '2026-05-12T00:00:00.000Z', updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockDownloadDocumentFile.mockResolvedValue(
      Buffer.from('Account,Amount,Currency,Date\nCash at bank,120000,NZD,2026-05-12')
    )
    mockSaveFinancialMetricObservations.mockRejectedValueOnce(new Error('insert failed'))

    await processDocument('document-123', 'user-123')

    expect(mockDeleteFinancialMetricObservationsForDocument).toHaveBeenCalledTimes(2)
    expect(mockUpdateDocumentRecord).toHaveBeenCalledWith(
      'document-123',
      'user-123',
      expect.objectContaining({ status: 'failed' })
    )
  })
})
