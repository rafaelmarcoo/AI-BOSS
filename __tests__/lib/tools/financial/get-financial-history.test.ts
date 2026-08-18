import { createGetFinancialHistoryTool } from '@/lib/tools/financial/get-financial-history'
import { readFinancialMetricHistorySeries } from '@/lib/financial-data/metric-history'

jest.mock('@/lib/financial-data/metric-history', () => {
  const actual = jest.requireActual('@/lib/financial-data/metric-history')
  return { ...actual, readFinancialMetricHistorySeries: jest.fn() }
})

const mockReadFinancialMetricHistorySeries = jest.mocked(readFinancialMetricHistorySeries)

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
    excludedCurrencyObservationCount: 0,
    hasMissingCurrencyObservations: false,
    unsupportedCurrencies: [],
  }
}

function collection(series = [summary('cash')]) {
  return {
    metricKey: 'cash' as const, label: 'Cash', range: 'all' as const, recordLimit: 12 as const,
    selectedCurrency: null, selectedSourceKey: null, availableCurrencies: ['NZD' as const],
    availableSources: [], series, excludedCurrencyObservationCount: 0,
    hasMissingCurrencyObservations: false, unsupportedCurrencies: [],
  }
}

describe('get_financial_history tool', () => {
  beforeEach(() => jest.clearAllMocks())

  it('formats a metric-specific history with source warning', async () => {
    mockReadFinancialMetricHistorySeries.mockResolvedValue(collection())

    const result = await createGetFinancialHistoryTool('user-1').handler({
      metricKey: 'cash',
      range: 'all',
    })

    expect(result).toContain('Cash history')
    expect(result).toContain('Trend: improving')
    expect(result).toContain('Warning: this history combines multiple sources')
  })

  it('summarizes each available metric for broad historical questions', async () => {
    mockReadFinancialMetricHistorySeries.mockImplementation(async ({ metricKey }) =>
      metricKey === 'cash'
        ? collection()
        : { ...collection([]), metricKey, label: metricKey }
    )

    const result = await createGetFinancialHistoryTool('user-1').handler({ range: 'all' })

    expect(mockReadFinancialMetricHistorySeries).toHaveBeenCalledTimes(5)
    expect(result).toContain('Cash history')
  })

  it('reports NZD and AUD as separate histories', async () => {
    mockReadFinancialMetricHistorySeries.mockResolvedValue(collection([
      summary('cash'),
      { ...summary('cash', 'worsening'), currency: 'AUD', points: summary('cash').points.map((point) => ({ ...point, currency: 'AUD' })) },
    ]))

    const result = await createGetFinancialHistoryTool('user-1').handler({ metricKey: 'cash', range: 'all' })

    expect(result).toContain('NZD 120')
    expect(result).toContain('AUD 120')
  })
})
