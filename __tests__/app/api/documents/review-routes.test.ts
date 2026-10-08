/** @jest-environment node */

import { NextRequest } from 'next/server'
import {
  GET as getDocument,
  PATCH as updateDocumentCategoryRoute,
} from '@/app/api/documents/[documentId]/route'
import { GET as getPreview } from '@/app/api/documents/[documentId]/preview/route'
import { POST as reprocessDocument } from '@/app/api/documents/[documentId]/reprocess/route'
import { POST as confirmDocument } from '@/app/api/documents/[documentId]/confirm/route'
import { PATCH as saveDocumentReview } from '@/app/api/documents/[documentId]/review/route'
import { POST as promoteItems } from '@/app/api/documents/[documentId]/candidates/from-items/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { requireCompanyAdmin } from '@/lib/companies'
import {
  getDocumentDetails,
  getDocumentPreview,
} from '@/lib/documents/review'
import {
  getAccessibleDocumentById,
  updateDocumentCategory,
  updateDocumentRecord,
} from '@/lib/documents/persistence'
import {
  confirmDocumentExtraction,
  promoteDocumentItemsToCandidate,
  saveDocumentExtractionReviewDraft,
} from '@/lib/documents/extraction-review-persistence'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/companies', () => ({
  requireCompanyAdmin: jest.fn(),
}))

jest.mock('@/lib/documents/review', () => ({
  DOCUMENT_PREVIEW_DEFAULT_PAGE_SIZE: 100,
  DOCUMENT_PREVIEW_MAX_PAGE_SIZE: 100,
  getDocumentDetails: jest.fn(),
  getDocumentPreview: jest.fn(),
}))

jest.mock('@/lib/documents/persistence', () => ({
  deleteUserDocument: jest.fn(),
  getAccessibleDocumentById: jest.fn(),
  updateDocumentCategory: jest.fn(),
  updateDocumentRecord: jest.fn(),
}))

jest.mock('@/lib/documents/process', () => ({
  processDocument: jest.fn(),
}))

jest.mock('@/lib/documents/extraction-review-persistence', () => ({
  confirmDocumentExtraction: jest.fn(),
  promoteDocumentItemsToCandidate: jest.fn(),
  saveDocumentExtractionReviewDraft: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockRequireCompanyAdmin = jest.mocked(requireCompanyAdmin)
const mockGetDocumentDetails = jest.mocked(getDocumentDetails)
const mockGetDocumentPreview = jest.mocked(getDocumentPreview)
const mockGetAccessibleDocumentById = jest.mocked(getAccessibleDocumentById)
const mockUpdateDocumentCategory = jest.mocked(updateDocumentCategory)
const mockUpdateDocumentRecord = jest.mocked(updateDocumentRecord)
const mockConfirmDocumentExtraction = jest.mocked(confirmDocumentExtraction)
const mockPromoteDocumentItemsToCandidate = jest.mocked(
  promoteDocumentItemsToCandidate
)
const mockSaveDocumentExtractionReviewDraft = jest.mocked(
  saveDocumentExtractionReviewDraft
)

const context = {
  params: Promise.resolve({ documentId: 'document-1' }),
}

const summary = {
  id: 'document-1',
  user_id: 'user-1',
  company_id: 'company-1',
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
  uploadedBy: { id: 'user-1', label: 'Owner' },
  access: {
    isOwner: true,
    canSaveDraft: true,
    canConfirm: true,
    canDelete: true,
  },
}

const fullDocument = {
  ...summary,
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
    mockRequireCompanyAdmin.mockResolvedValue({
      id: 'company-1',
      name: 'Example Ltd',
      userType: 'admin',
    })
    mockGetAccessibleDocumentById.mockResolvedValue(fullDocument)
    mockUpdateDocumentRecord.mockResolvedValue(summary)
    mockUpdateDocumentCategory.mockResolvedValue({
      ...summary,
      document_type: 'financial_statement',
    })
    mockSaveDocumentExtractionReviewDraft.mockResolvedValue(true)
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
    expect(mockGetAccessibleDocumentById).toHaveBeenCalledWith(
      'document-1',
      'user-1'
    )
    expect(mockUpdateDocumentRecord).not.toHaveBeenCalled()
  })

  it('confirms only after an admin and company-access check', async () => {
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
    expect(mockRequireCompanyAdmin).toHaveBeenCalledWith('user-1')
    expect(mockGetAccessibleDocumentById).toHaveBeenCalledWith(
      'document-1',
      'user-1'
    )
    expect(mockConfirmDocumentExtraction).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'document-1',
        ownerUserId: 'user-1',
        reviewerUserId: 'user-1',
        extractionRunId: 'run-1',
      })
    )
  })

  it('lets a company member save a pending draft without confirming it', async () => {
    const response = await saveDocumentReview(
      new NextRequest('http://localhost/api/documents/document-1/review', {
        method: 'PATCH',
        body: JSON.stringify({
          extractionRunId: 'run-1',
          candidates: [
            {
              candidateId: 'candidate-1',
              decision: 'pending',
              metricKey: null,
              value: 100000,
              currency: 'NZD',
              reportingDate: null,
            },
          ],
        }),
        headers: { 'content-type': 'application/json' },
      }),
      context
    )

    expect(response.status).toBe(200)
    expect(mockRequireCompanyAdmin).not.toHaveBeenCalled()
    expect(mockSaveDocumentExtractionReviewDraft).toHaveBeenCalledWith({
      documentId: 'document-1',
      ownerUserId: 'user-1',
      reviewerUserId: 'user-1',
      extractionRunId: 'run-1',
      candidates: [
        {
          candidateId: 'candidate-1',
          decision: 'pending',
          metricKey: null,
          value: 100000,
          currency: 'NZD',
          reportingDate: null,
        },
      ],
    })
  })

  it('updates a document category through the authenticated edit boundary', async () => {
    const response = await updateDocumentCategoryRoute(
      new NextRequest('http://localhost/api/documents/document-1', {
        method: 'PATCH',
        body: JSON.stringify({ documentType: 'financial_statement' }),
        headers: { 'content-type': 'application/json' },
      }),
      context
    )

    expect(response.status).toBe(200)
    expect(mockUpdateDocumentCategory).toHaveBeenCalledWith({
      documentId: 'document-1',
      requesterId: 'user-1',
      documentType: 'financial_statement',
    })
  })

  it('promotes selected Items without accepting a client-calculated total', async () => {
    mockPromoteDocumentItemsToCandidate.mockResolvedValue({
      id: 'candidate-promoted',
      extraction_run_id: 'run-1',
      original_payload: {},
      reviewed_payload: null,
      metric_key: 'monthly_expenses',
      value: 34.29,
      currency: 'NZD',
      reporting_date: '2026-08-31',
      confidence: 1,
      evidence: {},
      warnings: [],
      decision: 'pending',
      extractor_version: 'user_item_promotion_v1',
      reviewer_id: null,
      reviewed_at: null,
      created_at: '2026-08-31T00:00:00.000Z',
      updated_at: '2026-08-31T00:00:00.000Z',
    })

    const response = await promoteItems(
      new NextRequest(
        'http://localhost/api/documents/document-1/candidates/from-items',
        {
          method: 'POST',
          body: JSON.stringify({
            extractionRunId: 'run-1',
            itemIndexes: [0, 1],
            metricKey: 'monthly_expenses',
            currency: 'NZD',
            reportingDate: '2026-08-31',
            total: 999999,
          }),
          headers: { 'content-type': 'application/json' },
        }
      ),
      context
    )

    expect(response.status).toBe(201)
    expect(mockPromoteDocumentItemsToCandidate).toHaveBeenCalledWith({
      documentId: 'document-1',
      requesterId: 'user-1',
      extractionRunId: 'run-1',
      itemIndexes: [0, 1],
      metricKey: 'monthly_expenses',
      currency: 'NZD',
      reportingDate: '2026-08-31',
    })
  })
})
