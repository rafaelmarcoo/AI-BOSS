import { ApiError } from '@/lib/api/errors'
import { promoteDocumentItemsToCandidate } from '@/lib/documents/extraction-review-persistence'
import { getEditableDocument } from '@/lib/documents/persistence'

jest.mock('@/lib/documents/persistence', () => ({
  getEditableDocument: jest.fn(),
  updateDocumentRecord: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@/lib/companies', () => ({
  requireCompanyAdmin: jest.fn(),
}))

const mockGetEditableDocument = jest.mocked(getEditableDocument)

const document = {
  id: 'document-1',
  user_id: 'owner-1',
  company_id: 'company-1',
  conversation_id: null,
  file_name: 'note.jpg',
  file_type: 'image' as const,
  mime_type: 'image/jpeg',
  storage_path: 'owner-1/note.jpg',
  status: 'ready' as const,
  financial_review_status: 'pending' as const,
  document_type: 'other' as const,
  raw_text: 'Food 23.14',
  metadata: {
    extractedItems: [{ label: 'Food', value: 23.14, attributes: {} }],
  },
  error_message: null,
  created_at: '2026-08-31T00:00:00.000Z',
  updated_at: '2026-08-31T00:00:00.000Z',
}

const request = {
  documentId: 'document-1',
  requesterId: 'employee-1',
  extractionRunId: 'run-1',
  itemIndexes: [0],
  metricKey: 'monthly_expenses' as const,
  currency: 'NZD' as const,
  reportingDate: '2026-08-31',
}

describe('Item promotion persistence guardrails', () => {
  beforeEach(() => jest.clearAllMocks())

  it('preserves the existing editable-document authorization boundary', async () => {
    mockGetEditableDocument.mockRejectedValue(
      new ApiError(403, 'FORBIDDEN', 'You are not allowed to edit this document.')
    )

    await expect(promoteDocumentItemsToCandidate(request)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('requires confirmed documents to be reprocessed first', async () => {
    mockGetEditableDocument.mockResolvedValue({
      ...document,
      financial_review_status: 'confirmed',
    })

    await expect(promoteDocumentItemsToCandidate(request)).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    })
  })

  it('rejects Item indexes that are not present in stored metadata', async () => {
    mockGetEditableDocument.mockResolvedValue(document)

    await expect(
      promoteDocumentItemsToCandidate({ ...request, itemIndexes: [2] })
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    })
  })
})
