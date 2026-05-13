import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { listLatestFinancialMetricValues } from '@/lib/financial-data/persistence'

jest.mock('@/lib/financial-data/persistence', () => ({
  listLatestFinancialMetricValues: jest.fn(),
}))

const mockListLatestFinancialMetricValues = jest.mocked(
  listLatestFinancialMetricValues
)

describe('readSourceAwareMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
        asOfDate: '2026-04-30',
        provenance: {
          sourceType: 'document',
          sourceLabel: 'summary.csv',
        },
        confidence: 0.9,
        updatedAt: '2026-05-12T00:00:00.000Z',
      },
    })

    await expect(readSourceAwareMetrics('user-123')).resolves.toMatchObject({
      availableMetricCount: 4,
      unavailableMetricCount: 3,
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
      },
    })
    expect(mockListLatestFinancialMetricValues).toHaveBeenCalledWith('user-123')
  })
})
