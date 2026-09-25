import {
  collectFinancialAnalysisFromObservations,
} from '@/lib/financial-analysis/collector'
import type { FinancialMetricObservation } from '@/types/database'

function observation(params: {
  id: string
  metricKey: FinancialMetricObservation['metric_key']
  value: number
  date: string
  currency?: string | null
  documentId?: string
  sourceLabel?: string
}): FinancialMetricObservation {
  return {
    id: params.id,
    user_id: 'owner-1',
    connection_id: null,
    document_id: params.documentId ?? 'document-1',
    metric_key: params.metricKey,
    value: params.value,
    currency: params.currency === undefined ? 'NZD' : params.currency,
    period_start: null,
    period_end: null,
    as_of_date: params.date,
    source_type: 'document',
    source_label: params.sourceLabel ?? 'statement.csv',
    confidence: 0.95,
    evidence: {},
    raw_data: { privateSourcePayload: true },
    created_at: `${params.date}T00:00:00.000Z`,
    updated_at: `${params.date}T00:00:00.000Z`,
  }
}

const currentRows = [
  observation({ id: 'cash-current', metricKey: 'cash', value: 85000, date: '2026-06-30' }),
  observation({ id: 'ar-current', metricKey: 'accounts_receivable', value: 16000, date: '2026-06-30' }),
  observation({ id: 'ap-current', metricKey: 'accounts_payable', value: 14000, date: '2026-06-30' }),
  observation({ id: 'revenue-current', metricKey: 'monthly_revenue', value: 60000, date: '2026-06-30' }),
  observation({ id: 'expenses-current', metricKey: 'monthly_expenses', value: 70000, date: '2026-06-30' }),
  observation({ id: 'burn-current', metricKey: 'burn_rate', value: 17000, date: '2026-06-30' }),
]

describe('financial analysis collector', () => {
  it('builds source/currency-bound facts, history, forecasts, evidence, and fingerprint', () => {
    const cashHistory = [
      ['cash-mar', 112000, '2026-03-31'],
      ['cash-apr', 103000, '2026-04-30'],
      ['cash-may', 94000, '2026-05-31'],
    ].map(([id, value, date]) => observation({
      id: id as string,
      metricKey: 'cash',
      value: value as number,
      date: date as string,
    }))
    const collection = collectFinancialAnalysisFromObservations({
      request: { sourceKey: 'document:document-1', currency: 'NZD' },
      observations: [
        ...cashHistory,
        ...currentRows,
        observation({
          id: 'aud-cash',
          metricKey: 'cash',
          value: 999999,
          date: '2026-06-30',
          currency: 'AUD',
        }),
        observation({
          id: 'other-source',
          metricKey: 'cash',
          value: 777777,
          date: '2026-06-30',
          documentId: 'document-2',
        }),
        observation({
          id: 'stored-runway',
          metricKey: 'runway_months',
          value: 100,
          date: '2026-06-30',
          currency: null,
        }),
      ],
    })

    expect(collection.selection).toEqual({
      mode: 'single',
      sourceKey: 'document:document-1',
      sourceLabel: 'statement.csv',
      sourceKeys: ['document:document-1'],
      sources: [{
        sourceKey: 'document:document-1',
        sourceLabel: 'statement.csv',
        sourceType: 'document',
        documentId: 'document-1',
        connectionId: null,
      }],
      currency: 'NZD',
      reportingPeriodStart: '2026-03-31',
      reportingPeriodEnd: '2026-06-30',
      reportDate: '2026-06-30',
    })
    expect(collection.readiness.status).toBe('ready')
    expect(collection.facts.runway).toMatchObject({
      cashRunwayMonths: 5,
      workingCapitalAdjustedRunwayMonths: 5.12,
    })
    expect(collection.facts.operatingBalance).toMatchObject({
      operatingBalance: -10000,
      position: 'negative',
    })
    expect(collection.facts.history.find((fact) => fact.metricKey === 'cash'))
      .toMatchObject({ observationCount: 4, direction: 'worsening' })
    expect(collection.facts.forecasts.find((fact) => fact.metricKey === 'cash')?.values)
      .toHaveLength(6)
    expect(collection.facts.periodComparisons).toHaveLength(8)
    expect(collection.evidence.some((item) => item.value === 999999)).toBe(false)
    expect(collection.evidence.some((item) => item.value === 777777)).toBe(false)
    expect(collection.evidence.some((item) => item.metricKey === 'runway_months')).toBe(false)
    expect(collection.baselineFingerprint).toHaveLength(collection.evidence.length)
    expect(JSON.stringify(collection)).not.toContain('privateSourcePayload')
  })

  it('caps a metric history and evidence series at 12 observations', () => {
    const cashRows = Array.from({ length: 13 }, (_, index) => observation({
      id: `cash-${index}`,
      metricKey: 'cash',
      value: 100000 - index * 1000,
      date: `2026-06-${String(index + 1).padStart(2, '0')}`,
    }))
    const collection = collectFinancialAnalysisFromObservations({
      request: { sourceKey: 'document:document-1', currency: 'NZD' },
      observations: cashRows,
    })

    expect(collection.facts.history[0].observationCount).toBe(12)
    expect(collection.evidence).toHaveLength(12)
    expect(collection.baselineFingerprint).toHaveLength(12)
  })

  it('does not combine current facts from incompatible reporting dates', () => {
    const observations = currentRows.map((row) =>
      row.metric_key === 'burn_rate'
        ? { ...row, as_of_date: '2026-05-31' }
        : row
    )
    const collection = collectFinancialAnalysisFromObservations({
      request: { sourceKey: 'document:document-1', currency: 'NZD' },
      observations,
    })

    expect(collection.facts.runway).toBeNull()
    expect(collection.readiness.status).toBe('action_required')
    expect(collection.readiness.reasons.join(' ')).toContain(
      'Cash and monthly burn must share one reporting date'
    )
  })

  it('keeps cash runway but marks the section limited when adjusted inputs are incomplete', () => {
    const collection = collectFinancialAnalysisFromObservations({
      request: { sourceKey: 'document:document-1', currency: 'NZD' },
      observations: currentRows.filter((row) =>
        row.metric_key !== 'accounts_receivable' &&
        row.metric_key !== 'accounts_payable'
      ),
    })

    expect(collection.facts.runway).toMatchObject({
      cashRunwayMonths: 5,
      workingCapitalAdjustedRunwayMonths: null,
    })
    expect(collection.sections.find((section) => section.sectionId === 'current_runway')?.status)
      .toBe('limited')
  })

  it('rejects unavailable, unsupported, or unowned source/currency selections', () => {
    expect(() => collectFinancialAnalysisFromObservations({
      request: { sourceKey: 'document:not-owned', currency: 'NZD' },
      observations: currentRows,
    })).toThrow('unavailable or do not belong')

    expect(() => collectFinancialAnalysisFromObservations({
      request: { sourceKey: 'document:document-1', currency: 'USD' as 'NZD' },
      observations: currentRows,
    })).toThrow()
  })
})
