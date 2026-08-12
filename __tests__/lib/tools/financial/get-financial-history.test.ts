import { createGetFinancialHistoryTool } from '@/lib/tools/financial/get-financial-history'
import { readFinancialMetricHistory } from '@/lib/financial-data/metric-history'

jest.mock('@/lib/financial-data/metric-history', () => {
  const actual = jest.requireActual('@/lib/financial-data/metric-history')
  return { ...actual, readFinancialMetricHistory: jest.fn() }
})

const mockReadFinancialMetricHistory = jest.mocked(readFinancialMetricHistory)

function summary(
  metricKey: 'cash' | 'burn_rate',
  direction: 'improving' | 'worsening' = 'improving'
) {
  return {
    metricKey,
    label: metricKey === 'cash' ? 'Cash' : 'Burn rate',
    range: 'all' as const,
    points: [
      { date: '2026-05-01', dateSource: 'as_of_date' as const, value: 100, currency: 'NZD', sourceLabel: 'May CSV', sourceType: 'document' as const, confidence: 0.9, updatedAt: '2026-05-01T00:00:00.000Z' },
      { date: '2026-06-01', dateSource: 'as_of_date' as const, value: 120, currency: 'NZD', sourceLabel: 'June CSV', sourceType: 'document' as const, confidence: 0.9, updatedAt: '2026-06-01T00:00:00.000Z' },
    ],
    movement: 'increased' as const,
    direction,
    firstValue: 100,
    latestValue: 120,
    totalChange: 20,
    percentageChange: 20,
    averageChange: 20,
    currency: 'NZD',
    sourceLabels: ['May CSV', 'June CSV'],
    hasMixedSources: true,
    hasRecordedDateFallback: false,
    hasIncompatibleCurrencies: false,
  }
}

describe('get_financial_history tool', () => {
  beforeEach(() => jest.clearAllMocks())

  it('formats a metric-specific history with source warning', async () => {
    mockReadFinancialMetricHistory.mockResolvedValue(summary('cash'))

    const result = await createGetFinancialHistoryTool('user-1').handler({
      metricKey: 'cash',
      range: 'all',
    })

    expect(result).toContain('Cash history')
    expect(result).toContain('Trend: improving')
    expect(result).toContain('Warning: this history combines multiple sources')
  })

  it('summarizes each available metric for broad historical questions', async () => {
    mockReadFinancialMetricHistory.mockImplementation(async ({ metricKey }) =>
      metricKey === 'cash'
        ? summary('cash')
        : { ...summary('burn_rate', 'worsening'), metricKey, label: metricKey, points: [] }
    )

    const result = await createGetFinancialHistoryTool('user-1').handler({ range: 'all' })

    expect(mockReadFinancialMetricHistory).toHaveBeenCalledTimes(5)
    expect(result).toContain('Cash history')
  })
})
