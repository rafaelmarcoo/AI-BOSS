import {
  deriveRunwayHistoryObservations,
  summarizeRunwayTrend,
} from '@/lib/financial-data/runway-history'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'

function runway(value: number, asOfDate: string): AvailableFinancialMetricValue {
  return {
    status: 'available',
    key: 'runway_months',
    value,
    currency: null,
    periodStart: null,
    periodEnd: null,
    asOfDate,
    provenance: {
      sourceType: 'document',
      sourceLabel: 'demo.csv',
    },
    confidence: 0.9,
    updatedAt: `${asOfDate}T00:00:00.000Z`,
  }
}

function inputMetric(params: {
  key: FinancialMetricKey
  value: number
  date: string
  currency?: 'NZD' | 'AUD'
  sourceId?: string
}): AvailableFinancialMetricValue {
  return {
    status: 'available',
    key: params.key,
    value: params.value,
    currency: params.currency ?? 'NZD',
    periodStart: null,
    periodEnd: null,
    asOfDate: params.date,
    provenance: {
      sourceType: 'document',
      sourceLabel: `${params.sourceId ?? 'doc-1'}.csv`,
      sourceId: params.sourceId ?? 'doc-1',
    },
    confidence: 0.9,
    updatedAt: `${params.date}T00:00:00.000Z`,
  }
}

describe('summarizeRunwayTrend', () => {
  it('reports insufficient data with no observations', () => {
    expect(summarizeRunwayTrend([])).toMatchObject({
      direction: 'insufficient_data',
      change: null,
      averageChange: null,
    })
  })

  it('reports insufficient data with one observation', () => {
    expect(summarizeRunwayTrend([runway(5.4, '2026-05-12')])).toMatchObject({
      direction: 'insufficient_data',
    })
  })

  it('summarizes an improving runway trend', () => {
    expect(
      summarizeRunwayTrend([
        runway(4.2, '2026-05-12'),
        runway(5.4, '2026-06-12'),
      ])
    ).toMatchObject({
      direction: 'improving',
      change: 1.2,
      averageChange: 1.2,
    })
  })

  it('summarizes a declining runway trend', () => {
    expect(
      summarizeRunwayTrend([
        runway(5.4, '2026-05-12'),
        runway(4.4, '2026-06-12'),
        runway(3.4, '2026-07-12'),
      ])
    ).toMatchObject({
      direction: 'declining',
      change: -2,
      averageChange: -1,
    })
  })
})

describe('deriveRunwayHistoryObservations', () => {
  const observations = [
    inputMetric({ key: 'cash', value: 100000, date: '2026-03-31' }),
    inputMetric({ key: 'burn_rate', value: 10000, date: '2026-03-31' }),
    inputMetric({ key: 'accounts_receivable', value: 20000, date: '2026-03-31' }),
    inputMetric({ key: 'accounts_payable', value: 5000, date: '2026-03-31' }),
    inputMetric({ key: 'cash', value: 80000, date: '2026-04-30' }),
    inputMetric({ key: 'burn_rate', value: 10000, date: '2026-04-30' }),
  ]

  it('derives cash runway for every compatible source/currency/date pair', () => {
    expect(deriveRunwayHistoryObservations({
      observations,
      variant: 'cash',
    })).toEqual([
      expect.objectContaining({ value: 10, asOfDate: '2026-03-31', currency: 'NZD' }),
      expect.objectContaining({ value: 8, asOfDate: '2026-04-30', currency: 'NZD' }),
    ])
  })

  it('derives adjusted runway only when all four inputs match', () => {
    const result = deriveRunwayHistoryObservations({
      observations,
      variant: 'working_capital_adjusted',
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      value: 11.5,
      asOfDate: '2026-03-31',
      provenance: {
        evidence: {
          excerpt: '(100000 + 20000 - 5000) / 10000 = 11.5 months',
        },
      },
    })
  })

  it('does not combine otherwise matching inputs across sources or currencies', () => {
    const mismatched = [
      inputMetric({ key: 'cash', value: 100000, date: '2026-03-31' }),
      inputMetric({
        key: 'burn_rate',
        value: 10000,
        date: '2026-03-31',
        sourceId: 'doc-2',
      }),
      inputMetric({
        key: 'burn_rate',
        value: 10000,
        date: '2026-03-31',
        currency: 'AUD',
      }),
    ]

    expect(deriveRunwayHistoryObservations({
      observations: mismatched,
      variant: 'cash',
    })).toEqual([])
  })
})
