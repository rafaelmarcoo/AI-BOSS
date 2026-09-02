import { render, screen, waitFor } from '@testing-library/react'
import { GenUiCanvas } from '@/app/dashboard/runway/gen-ui/GenUiCanvas'
import { GEN_UI_PLAN_VERSION } from '@/lib/gen-ui/types'

describe('GenUiCanvas document review mode', () => {
  it('hides unrelated financial analysis and shows review-focused follow-ups', () => {
    render(
      <GenUiCanvas
        plan={{
          version: GEN_UI_PLAN_VERSION,
          source: 'chat',
          generatedAt: '2026-08-30T00:00:00.000Z',
          summary: 'Unreviewed document evidence only.',
          workspaceMode: 'document_review',
          widgets: [
            {
              id: 'documents-1',
              type: 'data_connections',
              title: 'Review document values',
              reason: 'The evidence still requires review.',
              data: { message: 'Review the extracted values before calculations.' },
            },
          ],
        }}
        baselineSummary="Current runway is unavailable."
        missingMetricLabels={['Cash', 'Runway months']}
        onAskChatbot={jest.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Document evidence workspace' })).toBeInTheDocument()
    expect(screen.getByText('Review required')).toBeInTheDocument()
    expect(screen.queryByText('Runway summary')).not.toBeInTheDocument()
    expect(screen.queryByText('Missing financial metrics')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: "Why can't AI-BOSS calculate with this document yet?",
    })).toBeInTheDocument()
    expect(screen.queryByRole('button', {
      name: 'Plan the next 6 months from my current runway.',
    })).not.toBeInTheDocument()
  })

  it('labels a trusted derived runway as calculated', () => {
    render(
      <GenUiCanvas
        plan={{
          version: GEN_UI_PLAN_VERSION,
          source: 'chat',
          generatedAt: '2026-08-31T00:00:00.000Z',
          summary: 'Current confirmed financial position.',
          workspaceMode: 'financial',
          widgets: [
            {
              id: 'sources-1',
              type: 'metric_source_evidence',
              title: 'Source evidence',
              reason: 'Shows the trusted calculation source.',
              data: {
                metrics: [{
                  label: 'Runway months',
                  value: '4.82 months',
                  sourceLabel: '01-valid-nzd-history.csv (calculated)',
                  sourceType: 'document',
                  confidence: 0.95,
                  tone: 'derived',
                  reportingDate: '2026-05-31',
                  dateStatus: 'calculated_for',
                  calculationRole: 'derived',
                }],
              },
            },
          ],
        }}
        baselineSummary="Current runway is 4.82 months."
        missingMetricLabels={[]}
        onAskChatbot={jest.fn()}
      />
    )

    expect(screen.getByText('4.82 months')).toBeInTheDocument()
    expect(screen.getByText('01-valid-nzd-history.csv (calculated)')).toBeInTheDocument()
    expect(screen.getByText('calculated')).toBeInTheDocument()
    expect(
      screen.getByText('Calculated for 31 May 2026 · Derived from compatible inputs')
    ).toBeInTheDocument()
    expect(screen.queryByText('unavailable')).not.toBeInTheDocument()
  })

  it('shows dated context and an explicit unavailable calculation period', () => {
    render(
      <GenUiCanvas
        plan={{
          version: GEN_UI_PLAN_VERSION,
          source: 'chat',
          generatedAt: '2026-09-02T00:00:00.000Z',
          summary: 'Date-aware runway context.',
          workspaceMode: 'financial',
          widgets: [{
            id: 'sources-1',
            type: 'metric_source_evidence',
            title: 'Source and dates',
            reason:
              "Shows each value's source, reporting date, and calculation role.",
            data: {
              metrics: [
                {
                  label: 'Accounts receivable',
                  value: 'NZD 18,000',
                  sourceLabel: '01-valid-nzd-history.csv',
                  sourceType: 'document',
                  confidence: 0.95,
                  tone: 'available',
                  reportingDate: '2026-04-30',
                  dateStatus: 'latest_recorded',
                  calculationRole: 'context_only',
                  detail: 'Does not match the 2026-05-31 runway calculation date.',
                },
                {
                  label: 'Working-capital-adjusted runway',
                  value: '-',
                  sourceLabel:
                    'Cannot calculate because May receivables was excluded.',
                  sourceType: 'none',
                  confidence: null,
                  tone: 'unavailable',
                  reportingDate: '2026-05-31',
                  dateStatus: 'unavailable_for',
                  calculationRole: 'unavailable',
                  detail: 'May receivables was explicitly excluded.',
                },
              ],
            },
          }],
        }}
        baselineSummary="Cash runway is 5.88 months."
        missingMetricLabels={[]}
        onAskChatbot={jest.fn()}
      />
    )

    expect(
      screen.getByText('Latest recorded · 30 Apr 2026 · Context only · not used')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Unavailable for 31 May 2026 · Not calculation-ready')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Does not match the 2026-05-31 runway calculation date.')
    ).toBeInTheDocument()
    expect(screen.getByText('May receivables was explicitly excluded.')).toBeInTheDocument()
    expect(screen.getByText('context only')).toBeInTheDocument()
    expect(screen.queryByText('available')).not.toBeInTheDocument()
  })

  it('labels an old review workspace as historical after confirmation', async () => {
    const originalFetch = global.fetch
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          documents: [{
            id: '9d36fa7e-77a3-49dc-be8c-5074a80797db',
            financial_review_status: 'confirmed',
          }],
        },
      }),
    } as Response)
    global.fetch = fetchMock

    render(
      <GenUiCanvas
        plan={{
          version: GEN_UI_PLAN_VERSION,
          source: 'chat',
          generatedAt: '2026-08-30T00:00:00.000Z',
          summary: 'Unreviewed document evidence only.',
          workspaceMode: 'document_review',
          documentReviewSnapshot: {
            documentIds: ['9d36fa7e-77a3-49dc-be8c-5074a80797db'],
            statusAtGeneration: 'pending',
          },
          widgets: [{
            id: 'documents-1',
            type: 'data_connections',
            title: 'Review document values',
            reason: 'The evidence required review at answer time.',
            data: { message: 'Review the extracted values before calculations.' },
          }],
        }}
        baselineSummary="Current runway is 4.82 months."
        missingMetricLabels={[]}
        onAskChatbot={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByRole('heading', {
      name: 'Historical document evidence',
    })).toBeInTheDocument())
    expect(screen.getByText('Historical snapshot')).toBeInTheDocument()
    expect(screen.getByText(/before the document became User-confirmed/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/documents', { cache: 'no-store' })
    global.fetch = originalFetch
  })
})
