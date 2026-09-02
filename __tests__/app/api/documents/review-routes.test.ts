/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as getDocument } from '@/app/api/documents/[documentId]/route'
import { GET as getPreview } from '@/app/api/documents/[documentId]/preview/route'
import { POST as reprocessDocument } from '@/app/api/documents/[documentId]/reprocess/route'
import { POST as confirmDocument } from '@/app/api/documents/[documentId]/confirm/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  getDocumentDetails,
  getDocumentPreview,
} from '@/lib/documents/review'
import {
  getDocumentById,
  updateDocumentRecord,
} from '@/lib/documents/persistence'
import { confirmDocumentExtraction } from '@/lib/documents/extraction-review-persistence'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/documents/review', () => ({
  DOCUMENT_PREVIEW_DEFAULT_PAGE_SIZE: 100,
  DOCUMENT_PREVIEW_MAX_PAGE_SIZE: 100,
  getDocumentDetails: jest.fn(),
  getDocumentPreview: jest.fn(),
}))

jest.mock('@/lib/documents/persistence', () => ({
  deleteUserDocument: jest.fn(),
  getDocumentById: jest.fn(),
  updateDocumentRecord: jest.fn(),
}))

jest.mock('@/lib/documents/process', () => ({
  processDocument: jest.fn(),
}))

jest.mock('@/lib/documents/extraction-review-persistence', () => ({
  confirmDocumentExtraction: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockGetDocumentDetails = jest.mocked(getDocumentDetails)
const mockGetDocumentPreview = jest.mocked(getDocumentPreview)
const mockGetDocumentById = jest.mocked(getDocumentById)
const mockUpdateDocumentRecord = jest.mocked(updateDocumentRecord)
const mockConfirmDocumentExtraction = jest.mocked(confirmDocumentExtraction)

const context = {
  params: Promise.resolve({ documentId: 'document-1' }),
}

const summary = {
  id: 'document-1',
  conversation_id: null,
  file_name: 'financials.xlsx',
  file_type: 'xlsx' as const,
  mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  status: 'processing' as const,
  financial_review_status: 'pending' as const,
  document_type: null,
  metadata: null,
  error_message: null,
  created_at: '2026-08-28T00:00:00.000Z',
  updated_at: '2026-08-28T00:00:00.000Z',
}

const fullDocument = {
  ...summary,
  user_id: 'user-1',
  storage_path: 'user-1/private.xlsx',
  raw_text: null,
}

describe('document review routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'access-token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
    mockGetDocumentById.mockResolvedValue(fullDocument)
    mockUpdateDocumentRecord.mockResolvedValue(summary)
  })

  it('loads document details through the authenticated owner boundary', async () => {
    mockGetDocumentDetails.mockResolvedValue({
      document: { ...summary, status: 'ready' },
      extractionRun: null,
      candidates: [],
    })

    const response = await getDocument(
      new NextRequest('http://localhost/api/documents/document-1'),
      context
    )

    expect(response.status).toBe(200)
    expect(mockGetDocumentDetails).toHaveBeenCalledWith('document-1', 'user-1')
  })

  it('applies preview pagination defaults and rejects oversized pages', async () => {
    mockGetDocumentPreview.mockResolvedValue({
      type: 'table',
      sheetName: 'Summary',
      availableSheets: [],
      headers: [],
      rows: [],
      page: 1,
      pageSize: 100,
      totalRows: 0,
      totalPages: 1,
      displayedColumnCount: 0,
      totalColumnCount: 0,
      warnings: [],
    })

    const response = await getPreview(
      new NextRequest('http://localhost/api/documents/document-1/preview'),
      context
    )
    expect(response.status).toBe(200)
    expect(mockGetDocumentPreview).toHaveBeenCalledWith({
      documentId: 'document-1',
      userId: 'user-1',
      page: 1,
      pageSize: 100,
    })

    const oversized = await getPreview(
      new NextRequest(
        'http://localhost/api/documents/document-1/preview?pageSize=101'
      ),
      context
    )
    expect(oversized.status).toBe(400)
  })

  it('rejects reprocessing while the owner document is already processing', async () => {
    const response = await reprocessDocument(
      new NextRequest('http://localhost/api/documents/document-1/reprocess', {
        method: 'POST',
        body: JSON.stringify({ selectedWorksheetNames: ['Summary', 'Cash Flow'] }),
        headers: { 'content-type': 'application/json' },
      }),
      context
    )

    expect(response.status).toBe(409)
    expect(mockGetDocumentById).toHaveBeenCalledWith('document-1', 'user-1')
    expect(mockUpdateDocumentRecord).not.toHaveBeenCalled()
  })

  it('confirms only after an ownership check and validated review payload', async () => {
    mockConfirmDocumentExtraction.mockResolvedValue(1)
    const response = await confirmDocument(
      new NextRequest('http://localhost/api/documents/document-1/confirm', {
        method: 'POST',
        body: JSON.stringify({
          extractionRunId: 'run-1',
          candidates: [
            {
              candidateId: 'candidate-1',
              decision: 'included',
              metricKey: 'cash',
              value: 100000,
              currency: 'NZD',
              reportingDate: '2026-07-31',
            },
          ],
        }),
        headers: { 'content-type': 'application/json' },
      }),
      context
    )

    expect(response.status).toBe(200)
    expect(mockGetDocumentById).toHaveBeenCalledWith('document-1', 'user-1')
    expect(mockConfirmDocumentExtraction).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'document-1',
        userId: 'user-1',
        extractionRunId: 'run-1',
      })
    )
  })
})
