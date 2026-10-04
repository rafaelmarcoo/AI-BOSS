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
import { extractAiAssistedDocument } from '@/lib/documents/ai-assisted-extraction'

const mockGetPdfDocument = jest.fn()

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  VerbosityLevel: { ERRORS: 0 },
  getDocument: (...args: unknown[]) => mockGetPdfDocument(...args),
}))

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

jest.mock('@/lib/documents/ai-assisted-extraction', () => ({
  extractAiAssistedDocument: jest.fn(),
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
const mockExtractAiAssistedDocument = jest.mocked(extractAiAssistedDocument)

describe('processDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReplaceDocumentChunks.mockResolvedValue([])
    mockUpdateDocumentRecord.mockResolvedValue({
      id: 'document-123',
      user_id: 'user-123',
      company_id: 'company-1',
      conversation_id: null,
      file_name: 'summary.csv',
      file_type: 'csv',
      mime_type: 'text/csv',
      status: 'ready',
      financial_review_status: 'legacy',
      document_type: null,
      metadata: null,
      error_message: null,
      created_at: '2026-05-12T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z',
      uploadedBy: { id: 'user-123', label: 'Owner' },
      access: {
        isOwner: true,
        canSaveDraft: true,
        canConfirm: true,
        canDelete: true,
      },
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
    mockExtractAiAssistedDocument.mockResolvedValue({ candidates: [], items: [] })
    mockGetPdfDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: jest.fn(async () => ({
          getTextContent: jest.fn(async () => ({
            items: [
              { str: 'As at 31 May 2026', transform: [1, 0, 0, 1, 0, 30] },
              { str: 'Cash at bank: $120,000 NZD', transform: [1, 0, 0, 1, 0, 10] },
            ],
          })),
          cleanup: jest.fn(),
        })),
      }),
      destroy: jest.fn(async () => undefined),
    })
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  it('stores extracted CSV metrics as pending review candidates', async () => {
    mockGetDocumentById.mockResolvedValue({
      id: 'document-123',
      user_id: 'user-123',
      company_id: 'company-1',
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
      company_id: 'company-1',
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
      company_id: 'company-1',
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

  it('does not call AI when deterministic PDF extraction returns a canonical candidate', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockGetDocumentById.mockResolvedValue({
      id: 'document-123', user_id: 'user-123', company_id: 'company-1',
      conversation_id: null, file_name: 'statement.pdf', file_type: 'pdf',
      mime_type: 'application/pdf', storage_path: 'user-123/statement.pdf',
      status: 'processing', financial_review_status: 'pending', document_type: null,
      raw_text: null, metadata: null, error_message: null,
      created_at: '2026-05-12T00:00:00.000Z', updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockDownloadDocumentFile.mockResolvedValue(Buffer.from('mock PDF'))

    await processDocument('document-123', 'user-123')

    expect(mockExtractAiAssistedDocument).not.toHaveBeenCalled()
    expect(mockSaveDocumentExtractionCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.arrayContaining([
          expect.objectContaining({ metricKey: 'cash', value: 120000 }),
        ]),
      })
    )
  })

  it('uses AI fallback when deterministic PDF extraction fails and keeps the original recoverable', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockGetPdfDocument.mockReturnValue({
      promise: Promise.reject(new Error('DOMMatrix unavailable')),
      destroy: jest.fn(async () => undefined),
    })
    mockGetDocumentById.mockResolvedValue({
      id: 'document-123', user_id: 'user-123', company_id: 'company-1',
      conversation_id: null, file_name: 'statement.pdf', file_type: 'pdf',
      mime_type: 'application/pdf', storage_path: 'user-123/statement.pdf',
      status: 'processing', financial_review_status: 'pending', document_type: null,
      raw_text: null, metadata: null, error_message: null,
      created_at: '2026-05-12T00:00:00.000Z', updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockDownloadDocumentFile.mockResolvedValue(Buffer.from('mock PDF'))
    mockExtractAiAssistedDocument.mockResolvedValue({
      candidates: [{
        originalPayload: { metricKey: 'cash', value: 90000 },
        metricKey: 'cash', value: 90000, currency: 'NZD',
        reportingDate: '2026-05-31', confidence: 0.7,
        evidence: { excerpt: 'Cash at bank NZD 90,000' }, warnings: [],
        extractorVersion: 'openai_assisted_v1',
      }],
      items: [],
    })

    await processDocument('document-123', 'user-123')

    expect(mockExtractAiAssistedDocument).toHaveBeenCalled()
    expect(mockUpdateDocumentRecord).toHaveBeenCalledWith(
      'document-123',
      'user-123',
      expect.objectContaining({ status: 'ready', financial_review_status: 'pending' })
    )
    expect(mockFailDocumentExtractionRun).not.toHaveBeenCalled()
  })

  it('retains deterministic output and the original when AI assistance fails', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockGetDocumentById.mockResolvedValue({
      id: 'document-123', user_id: 'user-123', company_id: 'company-1',
      conversation_id: null, file_name: 'notes.txt', file_type: 'text',
      mime_type: 'text/plain', storage_path: 'user-123/notes.txt',
      status: 'processing', financial_review_status: 'pending', document_type: null,
      raw_text: null, metadata: null, error_message: null,
      created_at: '2026-05-12T00:00:00.000Z', updated_at: '2026-05-12T00:00:00.000Z',
    })
    mockDownloadDocumentFile.mockResolvedValue(
      Buffer.from('Statement date: 31/05/2026\nCash: 80000 NZD')
    )
    mockExtractAiAssistedDocument.mockRejectedValue(new Error('model unavailable'))

    await processDocument('document-123', 'user-123')

    expect(mockSaveDocumentExtractionCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.arrayContaining([
          expect.objectContaining({ metricKey: 'cash', value: 80000 }),
        ]),
      })
    )
    expect(mockUpdateDocumentRecord).toHaveBeenCalledWith(
      'document-123',
      'user-123',
      expect.objectContaining({
        status: 'ready',
        metadata: expect.objectContaining({
          extractionWarnings: expect.arrayContaining([
            expect.objectContaining({ code: 'ai_assisted_failed' }),
          ]),
        }),
      })
    )
  })
})
