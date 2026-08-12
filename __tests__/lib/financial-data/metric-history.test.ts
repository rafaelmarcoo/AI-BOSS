import {
  summarizeMetricHistory,
  type HistoricalMetricKey,
} from '@/lib/financial-data/metric-history'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'

function observation(params: {
  key: HistoricalMetricKey
  value: number
  asOfDate?: string | null
  periodEnd?: string | null
  updatedAt?: string
  currency?: string | null
  sourceLabel?: string
}): AvailableFinancialMetricValue {
  return {
    status: 'available',
    key: params.key,
    value: params.value,
    currency: params.currency ?? 'NZD',
    periodStart: null,
    periodEnd: params.periodEnd ?? null,
    asOfDate: params.asOfDate ?? null,
    provenance: { sourceType: 'document', sourceLabel: params.sourceLabel ?? 'history.csv' },
    confidence: 0.9,
    updatedAt: params.updatedAt ?? '2026-06-01T00:00:00.000Z',
  }
}

describe('summarizeMetricHistory', () => {
  it('prefers as-of dates, then period end, then the recorded date', () => {
    const summary = summarizeMetricHistory({
      metricKey: 'cash',
      range: 'all',
      observations: [
        observation({ key: 'cash', value: 100, asOfDate: '2026-04-30', updatedAt: '2026-06-01T00:00:00.000Z' }),
        observation({ key: 'cash', value: 110, periodEnd: '2026-05-31', updatedAt: '2026-06-02T00:00:00.000Z' }),
        observation({ key: 'cash', value: 120, updatedAt: '2026-06-30T00:00:00.000Z' }),
      ],
    })

    expect(summary.points.map((point) => [point.date, point.dateSource])).toEqual([
      ['2026-04-30', 'as_of_date'],
      ['2026-05-31', 'period_end'],
      ['2026-06-30', 'updated_at'],
    ])
    expect(summary.hasRecordedDateFallback).toBe(true)
  })

  it('uses the most recently updated observation for duplicate dates', () => {
    const summary = summarizeMetricHistory({
      metricKey: 'cash',
      range: 'all',
      observations: [
        observation({ key: 'cash', value: 100, asOfDate: '2026-05-31', updatedAt: '2026-06-01T00:00:00.000Z' }),
        observation({ key: 'cash', value: 120, asOfDate: '2026-05-31', updatedAt: '2026-06-02T00:00:00.000Z' }),
        observation({ key: 'cash', value: 130, asOfDate: '2026-06-30' }),
      ],
    })

    expect(summary.points.map((point) => point.value)).toEqual([120, 130])
  })

  it.each([
    ['cash', [100, 120], 'improving'],
    ['monthly_revenue', [100, 120], 'improving'],
    ['runway_months', [4, 6], 'improving'],
    ['monthly_expenses', [100, 120], 'worsening'],
    ['burn_rate', [100, 120], 'worsening'],
  ] as const)('%s applies the correct financial direction', (key, values, direction) => {
    const summary = summarizeMetricHistory({
      metricKey: key,
      range: 'all',
      observations: values.map((value, index) => observation({
        key,
        value,
        asOfDate: `2026-0${index + 5}-01`,
      })),
    })

    expect(summary.direction).toBe(direction)
    expect(summary.movement).toBe('increased')
  })

  it('flags mixed sources and incompatible currencies', () => {
    const summary = summarizeMetricHistory({
      metricKey: 'cash',
      range: 'all',
      observations: [
        observation({ key: 'cash', value: 100, asOfDate: '2026-05-01', currency: 'NZD', sourceLabel: 'May CSV' }),
        observation({ key: 'cash', value: 120, asOfDate: '2026-06-01', currency: 'AUD', sourceLabel: 'June CSV' }),
      ],
    })

    expect(summary.hasMixedSources).toBe(true)
    expect(summary.hasIncompatibleCurrencies).toBe(true)
    expect(summary.direction).toBe('insufficient_data')
  })

  it('filters three-month history from the latest observation date', () => {
    const summary = summarizeMetricHistory({
      metricKey: 'cash',
      range: '3m',
      observations: [
        observation({ key: 'cash', value: 10, asOfDate: '2026-01-01' }),
        observation({ key: 'cash', value: 20, asOfDate: '2026-04-01' }),
        observation({ key: 'cash', value: 30, asOfDate: '2026-06-01' }),
        observation({ key: 'cash', value: 40, asOfDate: '2026-07-01' }),
      ],
    })

    expect(summary.points.map((point) => point.date)).toEqual([
      '2026-04-01',
      '2026-06-01',
      '2026-07-01',
    ])
  })

  it('does not claim a trend with one observation', () => {
    const summary = summarizeMetricHistory({
      metricKey: 'burn_rate',
      range: 'all',
      observations: [observation({ key: 'burn_rate', value: 120, asOfDate: '2026-06-01' })],
    })

    expect(summary.direction).toBe('insufficient_data')
    expect(summary.totalChange).toBeNull()
  })
})
