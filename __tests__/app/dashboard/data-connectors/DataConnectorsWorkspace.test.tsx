import { render, screen, waitFor } from '@testing-library/react'
import { DataConnectorsWorkspace } from '@/app/dashboard/data-connectors/DataConnectorsWorkspace'

jest.mock('@/components/accounting-connect', () => ({
  AccountingConnect: () => <div>Accounting connection controls</div>,
}))

function response(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response)
}

describe('DataConnectorsWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn((input) => {
      const url = String(input)
      if (url === '/api/integrations/status') {
        return response({
          success: true,
          data: [
            { provider: 'xero', status: 'connected', displayName: 'Demo Ltd', connectedAt: '2026-05-01T00:00:00.000Z', lastSyncedAt: '2026-06-01T00:00:00.000Z' },
            { provider: 'myob', status: 'available', displayName: null, connectedAt: null, lastSyncedAt: null },
            { provider: 'zoho_books', status: 'unavailable', displayName: null, connectedAt: null, lastSyncedAt: null },
          ],
        })
      }
      if (url === '/api/documents') {
        return response({
          success: true,
          data: {
            documents: [{
              id: 'document-1', user_id: 'user-1', company_id: 'company-1', conversation_id: null,
              file_name: 'may-statement.docx', file_type: 'docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              status: 'ready', financial_review_status: 'confirmed', document_type: null, metadata: null, error_message: null,
              created_at: '2026-06-01T00:00:00.000Z', updated_at: '2026-06-01T00:00:00.000Z',
              uploadedBy: { id: 'user-1', label: 'Owner' },
              access: { isOwner: true, canSaveDraft: true, canConfirm: true, canDelete: true },
            }],
          },
        })
      }
      if (url === '/api/financial-data/by-source') {
        return response({
          success: true,
          data: {
            metrics: [{
              id: 'observation-1', sourceKey: 'document:document-1', sourceLabel: 'May statement', sourceType: 'document',
              metricKey: 'cash', value: 80000, currency: 'NZD', reportingDate: '2026-05-31', confidence: 0.98,
              documentId: 'document-1', connectionId: null,
            }],
          },
        })
      }
      throw new Error(`Unexpected request: ${url}`)
    }) as jest.Mock
  })

  it('combines providers, document filters, and read-only confirmed comparison', async () => {
    render(<DataConnectorsWorkspace />)

    expect(await screen.findByText('Demo Ltd')).toBeInTheDocument()
    expect(screen.getByText('may-statement.docx')).toBeInTheDocument()
    expect(screen.getByText('Compare confirmed values across sources')).toBeInTheDocument()
    expect(screen.getByText('NZD 80,000')).toBeInTheDocument()
    expect(screen.getByText(/Unreviewed candidates and supplementary Items are excluded/)).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3))
  })
})
