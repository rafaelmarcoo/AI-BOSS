import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentReviewWorkspace } from '@/app/dashboard/documents/[documentId]/DocumentReviewWorkspace'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const details = {
  document: {
    id: 'document-1',
    conversation_id: null,
    file_name: 'financials.csv',
    file_type: 'csv' as const,
    mime_type: 'text/csv',
    status: 'ready' as const,
    financial_review_status: 'pending' as const,
    document_type: null,
    metadata: null,
    error_message: null,
    created_at: '2026-08-28T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
  },
  extractionRun: {
    id: 'run-1',
    status: 'extracted' as const,
    selected_worksheet_names: ['CSV'],
    suggested_worksheet_names: ['CSV'],
    worksheet_metadata: [],
    warnings: [],
    extractor_version: 'deterministic_csv_v2',
    error_message: null,
    started_at: '2026-08-28T00:00:00.000Z',
    completed_at: '2026-08-28T00:00:01.000Z',
    confirmed_at: null,
    superseded_at: null,
    created_at: '2026-08-28T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:01.000Z',
  },
  candidates: [
    {
      id: 'candidate-1',
      extraction_run_id: 'run-1',
      original_payload: {
        metricKey: 'cash',
        value: 100000,
        currency: 'NZD',
        asOfDate: '2026-07-31',
      },
      reviewed_payload: null,
      metric_key: 'cash' as const,
      value: 100000,
      currency: 'NZD' as const,
      reporting_date: '2026-07-31',
      confidence: 0.95,
      evidence: {
        sourceRowStart: 2,
        sourceRowEnd: 2,
        excerpt: 'Account: Cash; Amount: 100000',
      },
      warnings: [],
      decision: 'pending' as const,
      extractor_version: 'deterministic_csv_v2',
      reviewer_id: null,
      reviewed_at: null,
      created_at: '2026-08-28T00:00:00.000Z',
      updated_at: '2026-08-28T00:00:00.000Z',
    },
  ],
}

const preview = {
  type: 'table' as const,
  sheetName: 'CSV',
  availableSheets: [
    { name: 'CSV', visibility: 'visible' as const, suggested: true, empty: false },
  ],
  headers: ['Account', 'Amount'],
  rows: [{ rowNumber: 2, values: ['Cash', '100000'] }],
  page: 1,
  pageSize: 100,
  totalRows: 1,
  totalPages: 1,
  displayedColumnCount: 2,
  totalColumnCount: 2,
  warnings: [],
}

describe('DocumentReviewWorkspace', () => {
  const originalFetch = global.fetch
  let fetchMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/confirm') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { includedObservationCount: 1, financialReviewStatus: 'confirmed' },
          }),
        } as Response
      }
      if (url.includes('/preview')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: preview }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: details }),
      } as Response
    })
    global.fetch = fetchMock
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('requires an explicit include or exclude decision before approval', async () => {
    const user = userEvent.setup()
    render(<DocumentReviewWorkspace documentId="document-1" />)

    const approval = await screen.findByRole('button', {
      name: 'Use these values in AI-BOSS.',
    })
    expect(approval).toBeDisabled()
    expect(screen.getByText('Choose Include or Exclude for every candidate.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Include candidate 1' }))
    expect(approval).toBeEnabled()
    await user.click(approval)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/documents/document-1/confirm',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    const confirmCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/confirm') && init?.method === 'POST',
    )
    expect(JSON.parse(confirmCall?.[1]?.body as string)).toEqual({
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
    })
  })

  it('blocks approval when an included correction is invalid', async () => {
    const user = userEvent.setup()
    render(<DocumentReviewWorkspace documentId="document-1" />)

    await user.click(await screen.findByRole('button', { name: 'Include candidate 1' }))
    const value = screen.getByLabelText('Corrected value')
    fireEvent.change(value, { target: { value: '' } })

    expect(screen.getByRole('button', { name: 'Use these values in AI-BOSS.' })).toBeDisabled()
    expect(screen.getByText(/candidate needs a valid metric/i)).toBeInTheDocument()
  })

  it('shows source evidence and the original table alongside the review', async () => {
    render(<DocumentReviewWorkspace documentId="document-1" />)

    expect(await screen.findByText('Row 2 · 95% confidence')).toBeInTheDocument()
    expect(screen.getByText('Account: Cash; Amount: 100000')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'CSV original table preview' })).toBeInTheDocument()
  })
})
