import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentsWorkspace } from '@/app/dashboard/documents/DocumentsWorkspace'

const access = {
  isOwner: true,
  canSaveDraft: true,
  canConfirm: true,
  canDelete: true,
}

const documents = [
  {
    id: 'receipt-1', user_id: 'user-1', company_id: 'company-1', conversation_id: null,
    file_name: 'receipt.jpg', file_type: 'image' as const, mime_type: 'image/jpeg',
    status: 'ready' as const, financial_review_status: 'pending' as const,
    document_type: 'invoice_receipt' as const, metadata: null, error_message: null,
    created_at: '2026-10-08T02:00:00.000Z', updated_at: '2026-10-08T02:00:00.000Z',
    uploadedBy: { id: 'user-1', label: 'Owner' }, access,
  },
  {
    id: 'csv-1', user_id: 'user-1', company_id: 'company-1', conversation_id: null,
    file_name: 'ledger.csv', file_type: 'csv' as const, mime_type: 'text/csv',
    status: 'ready' as const, financial_review_status: 'confirmed' as const,
    document_type: null, metadata: null, error_message: null,
    created_at: '2026-10-07T02:00:00.000Z', updated_at: '2026-10-07T02:00:00.000Z',
    uploadedBy: { id: 'user-1', label: 'Owner' }, access,
  },
  {
    id: 'legacy-1', user_id: 'user-1', company_id: 'company-1', conversation_id: null,
    file_name: 'legacy.pdf', file_type: 'pdf' as const, mime_type: 'application/pdf',
    status: 'ready' as const, financial_review_status: 'not_required' as const,
    document_type: null, metadata: null, error_message: null,
    created_at: '2026-10-06T02:00:00.000Z', updated_at: '2026-10-06T02:00:00.000Z',
    uploadedBy: { id: 'user-1', label: 'Owner' }, access,
  },
]

describe('DocumentsWorkspace categorisation', () => {
  const originalFetch = global.fetch
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/legacy-1') && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              document: { ...documents[2], document_type: 'financial_statement' },
            },
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: { documents } }),
      } as Response
    })
    global.fetch = fetchMock
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('combines category, format, status and search filters with legacy fallbacks', async () => {
    const user = userEvent.setup()
    render(<DocumentsWorkspace />)

    expect(await screen.findByRole('tab', { name: 'Invoices & receipts (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Data exports (1)' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Other (1)' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Data exports (1)' }))
    expect(screen.getByText('ledger.csv')).toBeInTheDocument()
    expect(screen.queryByText('receipt.jpg')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All (3)' }))
    await user.click(screen.getByLabelText('File type'))
    await user.click(screen.getByRole('option', { name: 'PDF' }))
    await user.type(screen.getByLabelText('Search documents'), 'legacy')
    expect(screen.getByText('legacy.pdf')).toBeInTheDocument()
    expect(screen.queryByText('ledger.csv')).not.toBeInTheDocument()
  })

  it('lets an authorised editor correct a category', async () => {
    const user = userEvent.setup()
    render(<DocumentsWorkspace />)

    await screen.findByText('legacy.pdf')
    await user.click(screen.getByLabelText('Category for legacy.pdf'))
    await user.click(screen.getByRole('option', { name: 'Financial statements' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/documents/legacy-1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
    const call = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/legacy-1') && init?.method === 'PATCH'
    )
    expect(JSON.parse(call?.[1]?.body as string)).toEqual({
      documentType: 'financial_statement',
    })
  })
})
