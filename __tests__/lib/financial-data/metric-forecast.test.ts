import {
  summarizeMetricForecast,
  summarizeMetricForecastSeries,
  type ForecastHorizon,
} from '@/lib/financial-data/metric-forecast'
import type { HistoricalMetricKey, MetricHistoryRange } from '@/lib/financial-data/metric-history'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'

function observation(params: {
  key: HistoricalMetricKey
  value: number
  asOfDate: string
  currency?: string | null
  sourceLabel?: string
}): AvailableFinancialMetricValue {
  return {
    status: 'available',
    key: params.key,
    value: params.value,
    currency: params.currency ?? 'NZD',
    periodStart: null,
    periodEnd: null,
    asOfDate: params.asOfDate,
    provenance: { sourceType: 'document', sourceLabel: params.sourceLabel ?? 'forecast.csv' },
    confidence: 0.9,
    updatedAt: `${params.asOfDate}T00:00:00.000Z`,
  }
}

function forecast(params: {
  key?: HistoricalMetricKey
  range?: MetricHistoryRange
  horizon?: ForecastHorizon
  observations: AvailableFinancialMetricValue[]
}) {
  return summarizeMetricForecast({
    metricKey: params.key ?? 'cash',
    range: params.range ?? 'all',
    horizon: params.horizon ?? 3,
    observations: params.observations,
  })
}

describe('summarizeMetricForecast', () => {
  it('calculates a date-aware slope across unevenly dated observations and anchors on the latest actual', () => {
    const summary = forecast({
      observations: [
        observation({ key: 'cash', value: 100, asOfDate: '2026-01-01' }),
        observation({ key: 'cash', value: 120, asOfDate: '2026-03-01' }),
        observation({ key: 'cash', value: 160, asOfDate: '2026-07-01' }),
      ],
    })

    expect(summary.monthlySlope).toBeCloseTo(10, 0)
    expect(summary.latestActualValue).toBe(160)
    expect(summary.forecastPoints).toHaveLength(3)
    expect(summary.forecastPoints[0]).toEqual(expect.objectContaining({ date: '2026-08-01', value: 170.07 }))
  })

  it('generates six calendar-month forecast points', () => {
    const summary = forecast({
      horizon: 6,
      observations: [
        observation({ key: 'monthly_revenue', value: 100, asOfDate: '2026-01-01' }),
        observation({ key: 'monthly_revenue', value: 120, asOfDate: '2026-02-01' }),
      ],
    })

    expect(summary.forecastPoints).toHaveLength(6)
    expect(summary.forecastPoints.at(-1)?.date).toBe('2026-08-01')
  })

  it('never forecasts runway below zero', () => {
    const summary = forecast({
      key: 'runway_months',
      horizon: 6,
      observations: [
        observation({ key: 'runway_months', value: 3, asOfDate: '2026-01-01', currency: null }),
        observation({ key: 'runway_months', value: 1, asOfDate: '2026-02-01', currency: null }),
      ],
    })

    expect(summary.forecastPoints.map((point) => point.value)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('does not produce a forecast with insufficient or incompatible history', () => {
    const insufficient = forecast({
      observations: [observation({ key: 'cash', value: 100, asOfDate: '2026-01-01' })],
    })
    const incompatible = forecast({
      observations: [
        observation({ key: 'cash', value: 100, asOfDate: '2026-01-01', currency: 'NZD' }),
        observation({ key: 'cash', value: 110, asOfDate: '2026-02-01', currency: 'AUD' }),
      ],
    })

    expect(insufficient.forecastPoints).toEqual([])
    expect(insufficient.monthlySlope).toBeNull()
    expect(incompatible.forecastPoints).toEqual([])
    expect(incompatible.monthlySlope).toBeNull()
  })

  it('forecasts NZD and AUD independently without conversion', () => {
    const collection = summarizeMetricForecastSeries({
      metricKey: 'cash',
      range: 'all',
      horizon: 3,
      recordLimit: 'all',
      observations: [
        observation({ key: 'cash', value: 100, asOfDate: '2026-01-01', currency: 'NZD' }),
        observation({ key: 'cash', value: 110, asOfDate: '2026-02-01', currency: 'NZD' }),
        observation({ key: 'cash', value: 80, asOfDate: '2026-01-01', currency: 'AUD' }),
        observation({ key: 'cash', value: 70, asOfDate: '2026-02-01', currency: 'AUD' }),
      ],
    })

    expect(collection.series).toHaveLength(2)
    expect(collection.series.map((series) => series.history.currency)).toEqual(['AUD', 'NZD'])
    expect(collection.series.every((series) => series.forecastPoints.length === 3)).toBe(true)
    expect(collection.series[0].monthlySlope).toBeLessThan(0)
    expect(collection.series[1].monthlySlope).toBeGreaterThan(0)
  })
})
