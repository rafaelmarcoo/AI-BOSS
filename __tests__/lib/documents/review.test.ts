import {
  getDocumentDetails,
  getDocumentPreview,
} from '@/lib/documents/review'
import { getLatestDocumentExtractionReview } from '@/lib/documents/extraction-review-persistence'
import {
  createPdfDocumentPreviewUrl,
  downloadDocumentFile,
  getDocumentById,
} from '@/lib/documents/persistence'
import type { Document } from '@/types/database'

jest.mock('@/lib/documents/extraction-review-persistence', () => ({
  getLatestDocumentExtractionReview: jest.fn(),
}))

jest.mock('@/lib/documents/persistence', () => ({
  createPdfDocumentPreviewUrl: jest.fn(),
  downloadDocumentFile: jest.fn(),
  getDocumentById: jest.fn(),
}))

const mockGetLatestDocumentExtractionReview = jest.mocked(
  getLatestDocumentExtractionReview
)
const mockCreatePdfDocumentPreviewUrl = jest.mocked(
  createPdfDocumentPreviewUrl
)
const mockDownloadDocumentFile = jest.mocked(downloadDocumentFile)
const mockGetDocumentById = jest.mocked(getDocumentById)

function document(overrides: Partial<Document> = {}): Document {
  return {
    id: 'document-1',
    user_id: 'user-1',
    conversation_id: null,
    file_name: 'financials.csv',
    file_type: 'csv',
    mime_type: 'text/csv',
    storage_path: 'user-1/private-file.csv',
    status: 'ready',
    financial_review_status: 'pending',
    document_type: null,
    raw_text: 'private extracted text',
    metadata: null,
    error_message: null,
    created_at: '2026-08-28T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
    ...overrides,
  }
}

describe('document review service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetDocumentById.mockResolvedValue(document())
    mockGetLatestDocumentExtractionReview.mockResolvedValue({
      extractionRun: null,
      candidates: [],
    })
  })

  it('returns owner-scoped details without storage paths or raw text', async () => {
    const details = await getDocumentDetails('document-1', 'user-1')

    expect(mockGetDocumentById).toHaveBeenCalledWith('document-1', 'user-1')
    expect(details.document).not.toHaveProperty('storage_path')
    expect(details.document).not.toHaveProperty('raw_text')
    expect(JSON.stringify(details)).not.toContain('private-file.csv')
  })

  it('paginates table previews and displays at most 50 columns', async () => {
    const headers = Array.from({ length: 55 }, (_, index) => `Column ${index + 1}`)
    const row = Array.from({ length: 55 }, (_, index) => `Value ${index + 1}`)
    const csv = [headers.join(','), row.join(','), row.join(',')].join('\n')
    mockDownloadDocumentFile.mockResolvedValue(Buffer.from(csv))

    const preview = await getDocumentPreview({
      documentId: 'document-1',
      userId: 'user-1',
      page: 2,
      pageSize: 1,
    })

    expect(preview).toMatchObject({
      type: 'table',
      page: 2,
      pageSize: 1,
      totalRows: 2,
      totalPages: 2,
      displayedColumnCount: 50,
      totalColumnCount: 55,
    })
    if (preview.type === 'table') {
      expect(preview.headers).toHaveLength(50)
      expect(preview.rows).toHaveLength(1)
      expect(preview.rows[0].values).toHaveLength(50)
    }
  })

  it('returns only a short-lived signed URL for PDF preview', async () => {
    mockGetDocumentById.mockResolvedValue(
      document({ file_name: 'statement.pdf', file_type: 'pdf', mime_type: 'application/pdf' })
    )
    mockCreatePdfDocumentPreviewUrl.mockResolvedValue({
      url: 'https://example.test/signed-preview',
      expiresAt: '2026-08-28T00:05:00.000Z',
    })

    await expect(
      getDocumentPreview({
        documentId: 'document-1',
        userId: 'user-1',
        page: 1,
        pageSize: 100,
      })
    ).resolves.toEqual({
      type: 'pdf',
      url: 'https://example.test/signed-preview',
      expiresAt: '2026-08-28T00:05:00.000Z',
    })
    expect(mockCreatePdfDocumentPreviewUrl).toHaveBeenCalledWith(
      'document-1',
      'user-1'
    )
  })
})
