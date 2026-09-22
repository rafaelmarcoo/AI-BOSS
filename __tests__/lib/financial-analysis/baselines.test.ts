import { buildFinancialAnalysisBaselineOptions } from '@/lib/financial-analysis/baselines'
import type { FinancialMetricObservation } from '@/types/database'

function observation(params: {
  id: string
  documentId: string
  metricKey: FinancialMetricObservation['metric_key']
  currency: string | null
  date: string
  sourceLabel?: string
}): FinancialMetricObservation {
  return {
    id: params.id,
    user_id: 'owner-1',
    connection_id: null,
    document_id: params.documentId,
    metric_key: params.metricKey,
    value: 100,
    currency: params.currency,
    period_start: null,
    period_end: null,
    as_of_date: params.date,
    source_type: 'document',
    source_label: params.sourceLabel ?? 'statement.csv',
    confidence: 0.95,
    evidence: {},
    raw_data: {},
    created_at: `${params.date}T00:00:00.000Z`,
    updated_at: `${params.date}T00:00:00.000Z`,
  }
}

describe('financial analysis baseline options', () => {
  it('keeps each source and currency separate and reports its available metrics', () => {
    const options = buildFinancialAnalysisBaselineOptions([
      observation({ id: '1', documentId: 'doc-1', metricKey: 'cash', currency: 'NZD', date: '2026-06-30' }),
      observation({ id: '2', documentId: 'doc-1', metricKey: 'burn_rate', currency: 'NZD', date: '2026-07-31' }),
      observation({ id: '3', documentId: 'doc-1', metricKey: 'cash', currency: 'AUD', date: '2026-05-31' }),
      observation({ id: '4', documentId: 'doc-2', metricKey: 'monthly_revenue', currency: 'USD', date: '2026-08-31', sourceLabel: 'unsupported.csv' }),
    ])

    expect(options).toHaveLength(2)
    expect(options[0]).toMatchObject({
      sourceKey: 'document:doc-1',
      sourceLabel: 'statement.csv',
      currency: 'AUD',
      availableMetricKeys: ['cash'],
      observationCount: 1,
      latestReportingDate: '2026-05-31',
    })
    expect(options[1]).toMatchObject({
      sourceKey: 'document:doc-1',
      currency: 'NZD',
      availableMetricKeys: ['cash', 'burn_rate'],
      observationCount: 2,
      latestReportingDate: '2026-07-31',
    })
  })
})
