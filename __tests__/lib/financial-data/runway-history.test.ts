import { summarizeRunwayTrend } from '@/lib/financial-data/runway-history'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'

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
