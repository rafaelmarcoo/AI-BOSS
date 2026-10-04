import { buildLatestFinancialMetricsBySource } from '@/lib/financial-data/persistence'
import type { FinancialMetricObservation } from '@/types/database'

jest.mock('@/lib/supabase', () => ({ createAdminSupabaseClient: jest.fn() }))

function observation(
  overrides: Partial<FinancialMetricObservation> = {}
): FinancialMetricObservation {
  return {
    id: 'observation-1',
    user_id: 'user-1',
    company_id: 'company-1',
    connection_id: null,
    document_id: 'document-1',
    metric_key: 'cash',
    value: 80000,
    currency: 'NZD',
    period_start: null,
    period_end: null,
    as_of_date: '2026-05-31',
    source_type: 'document',
    source_label: 'May statement',
    confidence: 0.98,
    evidence: {},
    raw_data: {},
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('confirmed metric comparison by source', () => {
  it('keeps the latest reporting period for every source, currency, and metric', () => {
    const result = buildLatestFinancialMetricsBySource([
      observation({ id: 'old', value: 70000, as_of_date: '2026-04-30' }),
      observation({ id: 'new', value: 80000 }),
      observation({
        id: 'other-source',
        document_id: 'document-2',
        source_label: 'Other statement',
        value: 95000,
      }),
    ])

    expect(result).toHaveLength(2)
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'new', value: 80000 }),
      expect.objectContaining({ id: 'other-source', value: 95000 }),
    ]))
  })

  it('excludes unsupported monetary currencies and malformed unit rows', () => {
    const result = buildLatestFinancialMetricsBySource([
      observation({ id: 'usd', currency: 'USD' }),
      observation({ id: 'valid-aud', currency: 'AUD' }),
      observation({ id: 'invalid-runway', metric_key: 'runway_months', currency: 'NZD' }),
      observation({ id: 'valid-runway', metric_key: 'runway_months', currency: null, value: 4.7 }),
    ])

    expect(result.map((row) => row.id)).toEqual(['valid-aud', 'valid-runway'])
  })
})
