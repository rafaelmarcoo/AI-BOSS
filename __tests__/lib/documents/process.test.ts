import { processDocument } from '@/lib/documents/process'
import {
  downloadDocumentFile,
  getDocumentById,
  replaceDocumentChunks,
  updateDocumentRecord,
} from '@/lib/documents/persistence'
import { logDocumentIngestion } from '@/lib/documents/log-document-ingestion'
import {
  completeDocumentExtractionRun,
  createDocumentExtractionRun,
  failDocumentExtractionRun,
  saveDocumentExtractionCandidates,
} from '@/lib/documents/extraction-review-persistence'
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

jest.mock('@/lib/documents/extraction-review-persistence', () => ({
  completeDocumentExtractionRun: jest.fn(),
  createDocumentExtractionRun: jest.fn(),
  failDocumentExtractionRun: jest.fn(),
  saveDocumentExtractionCandidates: jest.fn(),
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
const mockCompleteDocumentExtractionRun = jest.mocked(
  completeDocumentExtractionRun
)
const mockCreateDocumentExtractionRun = jest.mocked(createDocumentExtractionRun)
const mockFailDocumentExtractionRun = jest.mocked(failDocumentExtractionRun)
const mockSaveDocumentExtractionCandidates = jest.mocked(
  saveDocumentExtractionCandidates
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
    mockCreateDocumentExtractionRun.mockResolvedValue({
      id: 'run-123',
      document_id: 'document-123',
      user_id: 'user-123',
      status: 'processing',
      selected_worksheet_names: [],
      suggested_worksheet_names: [],
      worksheet_metadata: [],
      warnings: [],
      extractor_version: 'deterministic_csv_v2',
      error_message: null,
      started_at: '2026-05-12T00:00:00.000Z',
      completed_at: null,
      confirmed_at: null,
      superseded_at: null,
      created_at: '2026-05-12T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockSaveDocumentExtractionCandidates.mockResolvedValue([{ id: 'candidate-1' }])
    mockCompleteDocumentExtractionRun.mockResolvedValue(undefined)
    mockFailDocumentExtractionRun.mockResolvedValue(undefined)
  })

  it('stores extracted CSV metrics as pending review candidates', async () => {
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

    expect(mockSaveDocumentExtractionCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        extractionRunId: 'run-123',
        userId: 'user-123',
        documentId: 'document-123',
        candidates: expect.arrayContaining([expect.objectContaining({
          metricKey: 'cash',
          value: 120000,
          currency: 'NZD',
          reportingDate: '2026-05-12',
        })]),
      })
    )
    expect(mockCompleteDocumentExtractionRun).toHaveBeenCalledWith(
      expect.objectContaining({ extractionRunId: 'run-123' })
    )
    expect(mockUpdateDocumentRecord).toHaveBeenCalledWith(
      'document-123',
      'user-123',
      expect.objectContaining({
        status: 'ready',
        financial_review_status: 'pending',
        metadata: expect.objectContaining({
          headers: ['Account', 'Amount', 'Currency', 'Date'],
          rowCount: 1,
          metricCandidateCount: 1,
          extractionRunId: 'run-123',
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

  it('records failure without deleting previously approved observations or the original', async () => {
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
    mockSaveDocumentExtractionCandidates.mockRejectedValueOnce(
      new Error('insert failed')
    )

    await processDocument('document-123', 'user-123')

    expect(mockFailDocumentExtractionRun).toHaveBeenCalledWith({
      extractionRunId: 'run-123',
      documentId: 'document-123',
      userId: 'user-123',
      errorMessage: 'insert failed',
    })
    expect(mockUpdateDocumentRecord).toHaveBeenCalledWith(
      'document-123',
      'user-123',
      expect.objectContaining({ status: 'failed' })
    )
  })

  it('marks a new document as not required when no financial candidates are found', async () => {
    mockGetDocumentById.mockResolvedValue({
      id: 'document-123', user_id: 'user-123', conversation_id: null,
      file_name: 'notes.csv', file_type: 'csv', mime_type: 'text/csv',
      storage_path: 'user-123/notes.csv', status: 'processing', document_type: null,
      financial_review_status: 'pending',
      raw_text: null, metadata: null, error_message: null,
      created_at: '2026-05-12T00:00:00.000Z', updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockDownloadDocumentFile.mockResolvedValue(
      Buffer.from('Month,Notes\nApril,Cash improved')
    )

    await processDocument('document-123', 'user-123')

    expect(mockSaveDocumentExtractionCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ candidates: [] })
    )
    expect(mockUpdateDocumentRecord).toHaveBeenCalledWith(
      'document-123',
      'user-123',
      expect.objectContaining({
        status: 'ready',
        financial_review_status: 'not_required',
        metadata: expect.objectContaining({ metricCandidateCount: 0 }),
      })
    )
  })
})
