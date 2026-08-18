import { readFinancialMetricForecastSeries } from '@/lib/financial-data/metric-forecast'
import { createGetFinancialForecastTool } from '@/lib/tools/financial/get-financial-forecast'
import { adaptToolToLangChain } from '@/lib/ai/tools'

jest.mock('@/lib/financial-data/metric-forecast', () => ({
  FORECAST_HORIZONS: [3, 6],
  readFinancialMetricForecastSeries: jest.fn(),
}))

const mockReadFinancialMetricForecastSeries = jest.mocked(readFinancialMetricForecastSeries)

const forecast = {
  metricKey: 'cash',
  label: 'Cash',
  range: 'all',
  horizon: 3,
  history: {
    points: [
      { date: '2026-05-01', value: 100, currency: 'NZD', sourceLabel: 'May CSV' },
      { date: '2026-06-01', value: 120, currency: 'NZD', sourceLabel: 'June CSV' },
    ],
    currency: 'NZD',
    hasIncompatibleCurrencies: false,
    hasMixedSources: true,
    hasRecordedDateFallback: false,
  },
  forecastPoints: [{ date: '2026-09-01', value: 180, kind: 'forecast' as const }],
  latestActualValue: 120,
  monthlySlope: 20,
  method: 'date_aware_linear_trend' as const,
  assumptions: [],
}

const forecastCollection = {
  metricKey: 'cash', label: 'Cash', range: 'all', recordLimit: 12,
  selectedCurrency: null, selectedSourceKey: null, availableCurrencies: ['NZD'],
  availableSources: [], excludedCurrencyObservationCount: 0,
  hasMissingCurrencyObservations: false, unsupportedCurrencies: [], horizon: 3,
  series: [forecast],
}

describe('get_financial_forecast tool', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns a deterministic metric-specific forecast with uncertainty wording', async () => {
    mockReadFinancialMetricForecastSeries.mockResolvedValue(forecastCollection as never)

    const result = await createGetFinancialForecastTool('user-1').handler({
      metricKey: 'cash',
      range: 'all',
      horizon: 3,
    })

    expect(mockReadFinancialMetricForecastSeries).toHaveBeenCalledWith({
      userId: 'user-1', metricKey: 'cash', range: 'all', horizon: 3,
      recordLimit: 12, currency: null,
    })
    expect(result).toContain('Cash — NZD 3-month forecast')
    expect(result).toContain('not a guaranteed prediction')
    expect(result).toContain('combine multiple sources')
  })

  it('summarizes each available metric for a broad question', async () => {
    mockReadFinancialMetricForecastSeries.mockResolvedValue(forecastCollection as never)

    await createGetFinancialForecastTool('user-1').handler({ range: 'all', horizon: 6 })

    expect(mockReadFinancialMetricForecastSeries).toHaveBeenCalledTimes(5)
    expect(mockReadFinancialMetricForecastSeries).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', horizon: 6 })
    )
  })

  it('uses a JSON Schema-compatible input contract for the agent', () => {
    expect(() => adaptToolToLangChain(createGetFinancialForecastTool('user-1'))).not.toThrow()
  })
})
