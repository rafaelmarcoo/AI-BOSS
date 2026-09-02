import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { listLatestFinancialMetricValues } from '@/lib/financial-data/persistence'
import { listConfirmedDocumentExcludedCandidates } from '@/lib/documents/extraction-review-persistence'

jest.mock('@/lib/financial-data/persistence', () => ({
  listLatestFinancialMetricValues: jest.fn(),
}))

jest.mock('@/lib/documents/extraction-review-persistence', () => ({
  listConfirmedDocumentExcludedCandidates: jest.fn(),
}))

const mockListLatestFinancialMetricValues = jest.mocked(
  listLatestFinancialMetricValues
)
const mockListConfirmedDocumentExcludedCandidates = jest.mocked(
  listConfirmedDocumentExcludedCandidates
)

describe('readSourceAwareMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListConfirmedDocumentExcludedCandidates.mockResolvedValue([])
  })

  it('returns complete source-aware metrics and runway input', async () => {
    mockListLatestFinancialMetricValues.mockResolvedValue({
      cash: {
        status: 'available',
        key: 'cash',
        value: 120000,
        currency: 'NZD',
        periodStart: null,
        periodEnd: null,
        asOfDate: '2026-05-12',
        provenance: {
          sourceType: 'document',
          sourceLabel: 'summary.csv',
        },
        confidence: 0.95,
        updatedAt: '2026-05-12T00:00:00.000Z',
      },
      accounts_receivable: {
        status: 'available',
        key: 'accounts_receivable',
        value: 45000,
        currency: 'NZD',
        periodStart: null,
        periodEnd: null,
        asOfDate: '2026-05-12',
        provenance: {
          sourceType: 'document',
          sourceLabel: 'summary.csv',
        },
        confidence: 0.95,
        updatedAt: '2026-05-12T00:00:00.000Z',
      },
      accounts_payable: {
        status: 'available',
        key: 'accounts_payable',
        value: 21000,
        currency: 'NZD',
        periodStart: null,
        periodEnd: null,
        asOfDate: '2026-05-12',
        provenance: {
          sourceType: 'document',
          sourceLabel: 'summary.csv',
        },
        confidence: 0.95,
        updatedAt: '2026-05-12T00:00:00.000Z',
      },
      burn_rate: {
        status: 'available',
        key: 'burn_rate',
        value: 28000,
        currency: 'NZD',
        periodStart: null,
        periodEnd: null,
        asOfDate: '2026-05-12',
        provenance: {
          sourceType: 'document',
          sourceLabel: 'summary.csv',
        },
        confidence: 0.9,
        updatedAt: '2026-05-12T00:00:00.000Z',
      },
    })

    await expect(readSourceAwareMetrics('user-123')).resolves.toMatchObject({
      availableMetricCount: 5,
      unavailableMetricCount: 2,
      runwayInput: {
        cash: 120000,
        ar: 45000,
        ap: 21000,
        burn: 28000,
      },
      metrics: {
        cash: {
          status: 'available',
        },
        monthly_revenue: {
          status: 'unavailable',
          reason: 'not_provided',
        },
        runway_months: {
          status: 'available',
          value: 4.29,
          currency: null,
          provenance: {
            sourceLabel: 'summary.csv (cash runway calculated)',
          },
        },
      },
      workingCapitalAdjustedRunway: {
        status: 'available',
        value: 5.14,
        provenance: {
          sourceLabel:
            'summary.csv (working-capital-adjusted runway calculated)',
        },
      },
    })
    expect(mockListLatestFinancialMetricValues).toHaveBeenCalledWith('user-123')
  })

  it('explains when an adjusted-runway input was explicitly excluded', async () => {
    const metric = (
      key: 'cash' | 'accounts_receivable' | 'accounts_payable' | 'burn_rate',
      value: number,
      asOfDate: string
    ) => ({
      status: 'available' as const,
      key,
      value,
      currency: 'NZD',
      periodStart: null,
      periodEnd: null,
      asOfDate,
      provenance: {
        sourceType: 'document' as const,
        sourceLabel: '01-valid-nzd-history.csv',
        sourceId: 'document-123',
      },
      confidence: 0.95,
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    mockListLatestFinancialMetricValues.mockResolvedValue({
      cash: metric('cash', 100000, '2026-05-31'),
      accounts_receivable: metric('accounts_receivable', 18000, '2026-04-30'),
      accounts_payable: metric('accounts_payable', 14000, '2026-05-31'),
      burn_rate: metric('burn_rate', 17000, '2026-05-31'),
    })
    mockListConfirmedDocumentExcludedCandidates.mockResolvedValue([
      {
        id: 'candidate-ar-may',
        extraction_run_id: 'run-1',
        document_id: 'document-123',
        user_id: 'user-123',
        original_payload: { value: 16000 },
        reviewed_payload: { value: 16000, decision: 'excluded' },
        metric_key: 'accounts_receivable',
        value: 16000,
        currency: 'NZD',
        reporting_date: '2026-05-31',
        confidence: 0.95,
        evidence: {},
        warnings: [],
        decision: 'excluded',
        extractor_version: 'deterministic_csv_v2',
        reviewer_id: 'user-123',
        reviewed_at: '2026-06-01T00:00:00.000Z',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ])

    await expect(readSourceAwareMetrics('user-123')).resolves.toMatchObject({
      metrics: {
        runway_months: {
          status: 'available',
          value: 5.88,
        },
      },
      workingCapitalAdjustedRunway: {
        status: 'unavailable',
        detail:
          'Cannot calculate working-capital-adjusted runway because accounts receivable for 2026-05-31 was explicitly excluded during document review.',
      },
    })
  })
})
