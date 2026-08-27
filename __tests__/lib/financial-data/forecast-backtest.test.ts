import { backtestMetricForecasts } from '@/lib/financial-data/forecast-backtest'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data'

function observation(params: {
  value: number
  date?: string
  currency?: string | null
  sourceId?: string
  sourceLabel?: string
}): AvailableFinancialMetricValue {
  return {
    status: 'available',
    key: 'cash',
    value: params.value,
    currency: params.currency === undefined ? 'NZD' : params.currency,
    periodStart: null,
    periodEnd: null,
    asOfDate: params.date ?? null,
    provenance: {
      sourceType: 'document',
      sourceLabel: params.sourceLabel ?? 'Cash history',
      sourceId: params.sourceId ?? 'document-1',
    },
    confidence: 1,
    updatedAt: `${params.date ?? '2026-01-01'}T00:00:00.000Z`,
  }
}

describe('fixed-origin forecast backtesting', () => {
  it('trains once and compares every later actual from the same origin', () => {
    const [result] = backtestMetricForecasts({
      metricKey: 'cash',
      observations: [
        observation({ value: 100, date: '2026-01-01' }),
        observation({ value: 110, date: '2026-02-01' }),
        observation({ value: 120, date: '2026-03-01' }),
        observation({ value: 130, date: '2026-04-01' }),
        observation({ value: 145, date: '2026-05-01' }),
      ],
    })

    expect(result.method).toBe('fixed_origin_date_aware_linear_trend')
    expect(result.trainingPointCount).toBe(3)
    expect(result.points).toHaveLength(2)
    expect(result.points.every((point) => point.forecastOriginDate === '2026-03-01')).toBe(true)
    expect(result.points[0].absoluteError).toBeLessThan(1)
    expect(result.points[1].absoluteError).toBeGreaterThan(4)
  })

  it('reports no percentage error when the actual is zero', () => {
    const [result] = backtestMetricForecasts({
      metricKey: 'cash',
      observations: [
        observation({ value: 30, date: '2026-01-01' }),
        observation({ value: 20, date: '2026-02-01' }),
        observation({ value: 10, date: '2026-03-01' }),
        observation({ value: 0, date: '2026-04-01' }),
      ],
    })

    expect(result.points[0].absoluteError).toBeLessThan(1)
    expect(result.points[0].percentageError).toBeNull()
    expect(result.meanAbsolutePercentageError).toBeNull()
  })

  it('never combines sources or currencies and excludes undated fallback data', () => {
    const dated = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']
    const observations = dated.flatMap((date, index) => [
      observation({ value: 100 + index * 10, date, currency: 'NZD', sourceId: 'a', sourceLabel: 'A' }),
      observation({ value: 80 - index * 5, date, currency: 'AUD', sourceId: 'a', sourceLabel: 'A' }),
      observation({ value: 50 + index, date, currency: 'NZD', sourceId: 'b', sourceLabel: 'B' }),
    ])
    observations.push(observation({ value: 999, date: undefined, sourceId: 'a' }))

    const results = backtestMetricForecasts({ metricKey: 'cash', observations })

    expect(results).toHaveLength(3)
    expect(results.map((result) => `${result.sourceKey}:${result.currency}`)).toEqual([
      'document:a:AUD',
      'document:a:NZD',
      'document:b:NZD',
    ])
    expect(results.every((result) => result.trainingPointCount === 3 && result.testPointCount === 1)).toBe(true)
  })

  it('omits series without enough dated observations', () => {
    expect(
      backtestMetricForecasts({
        metricKey: 'cash',
        observations: [
          observation({ value: 100, date: '2026-01-01' }),
          observation({ value: 110, date: '2026-02-01' }),
          observation({ value: 120, date: '2026-03-01' }),
        ],
      }),
    ).toEqual([])
  })
})
