import { getDocumentStatusPresentation } from '@/lib/documents/presentation'
import type { DocumentSummary } from '@/lib/documents/types'

function document(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: 'document-1',
    conversation_id: null,
    file_name: 'statement.pdf',
    file_type: 'pdf',
    mime_type: 'application/pdf',
    status: 'ready',
    financial_review_status: 'not_required',
    document_type: null,
    metadata: null,
    error_message: null,
    created_at: '2026-08-28T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
    ...overrides,
  }
}

describe('document status presentation', () => {
  it('distinguishes evidence, review, confirmation, no metrics, and failures', () => {
    expect(getDocumentStatusPresentation(document()).label).toBe('Ready for evidence')
    expect(
      getDocumentStatusPresentation(
        document({ metadata: { scanned: true } }),
      ).label,
    ).toBe('No metrics found')
    expect(
      getDocumentStatusPresentation(
        document({ financial_review_status: 'pending' }),
      ).label,
    ).toBe('Review required')
    expect(
      getDocumentStatusPresentation(
        document({ financial_review_status: 'confirmed' }),
      ).label,
    ).toBe('User-confirmed')
    expect(
      getDocumentStatusPresentation(document({ status: 'failed' })).label,
    ).toBe('Failed')
  })
})
