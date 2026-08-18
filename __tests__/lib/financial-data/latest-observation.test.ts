import { selectLatestFinancialMetricObservations } from '@/lib/financial-data/latest-observation'
import type { FinancialMetricObservation } from '@/types/database'

function observation(
  id: string,
  metricKey: FinancialMetricObservation['metric_key'],
  value: number,
  asOfDate: string
): FinancialMetricObservation {
  return {
    id,
    user_id: 'user-1',
    connection_id: null,
    document_id: 'document-1',
    metric_key: metricKey,
    value,
    currency: 'NZD',
    period_start: null,
    period_end: asOfDate,
    as_of_date: asOfDate,
    source_type: 'document',
    source_label: 'ai-boss-demo-consistent.csv',
    confidence: 0.95,
    evidence: {},
    raw_data: {},
    created_at: '2026-08-18T04:00:00.000Z',
    updated_at: '2026-08-18T04:00:00.000Z',
  }
}

describe('selectLatestFinancialMetricObservations', () => {
  it('uses the latest financial reporting date when one upload shares a timestamp', () => {
    const rows = [
      observation('march', 'cash', 100_000, '2026-03-31'),
      observation('april', 'cash', 90_000, '2026-04-30'),
      observation('may', 'cash', 80_000, '2026-05-31'),
      observation('revenue', 'monthly_revenue', 46_000, '2026-05-31'),
    ]

    expect(selectLatestFinancialMetricObservations(rows)).toEqual([
      expect.objectContaining({ metric_key: 'cash', value: 80_000 }),
      expect.objectContaining({ metric_key: 'monthly_revenue', value: 46_000 }),
    ])
  })

  it('falls back to period end when an as-of date is unavailable', () => {
    const older = observation('older', 'cash', 90_000, '2026-04-30')
    const latest = {
      ...observation('latest', 'cash', 80_000, '2026-05-31'),
      as_of_date: null,
    }

    expect(selectLatestFinancialMetricObservations([latest, older])).toEqual([
      expect.objectContaining({ id: 'latest', value: 80_000 }),
    ])
  })
})
