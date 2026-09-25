import { collectFinancialAnalysisFromObservations } from '@/lib/financial-analysis/collector'
import {
  FinancialAnalysisRequestSchema,
  previewFinancialAnalysisTimeline,
  resolveFinancialAnalysisTimeline,
} from '@/lib/financial-analysis/timeline'
import type { FinancialMetricObservation } from '@/types/database'

function observation(params: {
  id: string
  documentId: string
  metricKey: FinancialMetricObservation['metric_key']
  value: number
  date: string
  currency?: string
}): FinancialMetricObservation {
  return {
    id: params.id,
    user_id: 'owner-1',
    connection_id: null,
    document_id: params.documentId,
    metric_key: params.metricKey,
    value: params.value,
    currency: params.currency ?? 'NZD',
    period_start: null,
    period_end: null,
    as_of_date: params.date,
    source_type: 'document',
    source_label: `${params.documentId}.csv`,
    confidence: 0.95,
    evidence: {},
    raw_data: {},
    created_at: `${params.date}T00:00:00.000Z`,
    updated_at: `${params.date}T00:00:00.000Z`,
  }
}

const sourceKeys = ['document:doc-1', 'document:doc-2']

describe('financial analysis statement timeline', () => {
  it('keeps legacy requests compatible and enforces single/timeline source counts', () => {
    expect(FinancialAnalysisRequestSchema.parse({
      sourceKey: 'document:doc-1',
      currency: 'NZD',
    })).toEqual({
      mode: 'single',
      sourceKeys: ['document:doc-1'],
      currency: 'NZD',
      asOfDate: null,
      conflictResolutions: {},
    })
    expect(FinancialAnalysisRequestSchema.safeParse({
      mode: 'timeline',
      sourceKeys: ['document:doc-1'],
      currency: 'NZD',
    }).success).toBe(false)
    expect(FinancialAnalysisRequestSchema.safeParse({
      mode: 'single',
      sourceKeys,
      currency: 'NZD',
    }).success).toBe(false)
    expect(FinancialAnalysisRequestSchema.safeParse({
      mode: 'timeline',
      sourceKeys: ['document:doc-1', 'document:doc-1'],
      currency: 'NZD',
    }).success).toBe(false)
  })

  it('previews dates, coverage, gaps, and overlapping-value conflicts', () => {
    const observations = [
      observation({ id: 'old-cash', documentId: 'doc-1', metricKey: 'cash', value: 100000, date: '2026-05-31' }),
      observation({ id: 'cash-a', documentId: 'doc-1', metricKey: 'cash', value: 90000, date: '2026-06-30' }),
      observation({ id: 'cash-b', documentId: 'doc-2', metricKey: 'cash', value: 85000, date: '2026-06-30' }),
      observation({ id: 'revenue', documentId: 'doc-2', metricKey: 'monthly_revenue', value: 60000, date: '2026-06-30' }),
    ]

    const preview = previewFinancialAnalysisTimeline({
      request: { mode: 'timeline', sourceKeys, currency: 'NZD' },
      observations,
    })

    expect(preview.suggestedLatestDate).toBe('2026-06-30')
    expect(preview.reportingDates).toEqual(['2026-05-31', '2026-06-30'])
    expect(preview.metricCoverage[1]).toMatchObject({
      reportingDate: '2026-06-30',
      metricKeys: ['cash', 'monthly_revenue'],
    })
    expect(preview.conflicts).toEqual([expect.objectContaining({
      conflictId: 'cash::2026-06-30',
      metricKey: 'cash',
      options: expect.arrayContaining([
        expect.objectContaining({ observationId: 'cash-a', value: 90000 }),
        expect.objectContaining({ observationId: 'cash-b', value: 85000 }),
      ]),
    })])
    expect(preview.warnings.join(' ')).toContain('Latest-period gaps')
  })

  it('requires review of the latest date and explicit resolution of every conflict', () => {
    const observations = [
      observation({ id: 'cash-a', documentId: 'doc-1', metricKey: 'cash', value: 90000, date: '2026-06-30' }),
      observation({ id: 'cash-b', documentId: 'doc-2', metricKey: 'cash', value: 85000, date: '2026-06-30' }),
    ]

    expect(() => resolveFinancialAnalysisTimeline({
      request: {
        mode: 'timeline',
        sourceKeys,
        currency: 'NZD',
        asOfDate: null,
        conflictResolutions: {},
      },
      observations,
    })).toThrow('Review the current timeline preview')

    expect(() => resolveFinancialAnalysisTimeline({
      request: {
        mode: 'timeline',
        sourceKeys,
        currency: 'NZD',
        asOfDate: '2026-06-30',
        conflictResolutions: {},
      },
      observations,
    })).toThrow('Resolve every overlapping financial value')

    const resolved = resolveFinancialAnalysisTimeline({
      request: {
        mode: 'timeline',
        sourceKeys,
        currency: 'NZD',
        asOfDate: '2026-06-30',
        conflictResolutions: { 'cash::2026-06-30': 'cash-b' },
      },
      observations,
    })
    expect(resolved.calculationRows).toHaveLength(1)
    expect(resolved.calculationRows[0].id).toBe('cash-b')
    expect(resolved.evidenceResolutionById.get('cash-a')).toEqual({
      usedInCalculations: false,
      resolution: 'excluded_conflict',
    })
  })

  it('merges complementary metrics from different sources on the same reporting date', () => {
    const observations = [
      observation({ id: 'cash', documentId: 'doc-1', metricKey: 'cash', value: 90000, date: '2026-06-30' }),
      observation({ id: 'burn', documentId: 'doc-1', metricKey: 'burn_rate', value: 18000, date: '2026-06-30' }),
      observation({ id: 'ar', documentId: 'doc-2', metricKey: 'accounts_receivable', value: 12000, date: '2026-06-30' }),
      observation({ id: 'ap', documentId: 'doc-2', metricKey: 'accounts_payable', value: 3000, date: '2026-06-30' }),
    ]

    const collection = collectFinancialAnalysisFromObservations({
      request: {
        mode: 'timeline',
        sourceKeys,
        currency: 'NZD',
        asOfDate: '2026-06-30',
        conflictResolutions: {},
      },
      observations,
    })

    expect(collection.facts.runway).toMatchObject({
      cashRunwayMonths: 5,
      workingCapitalAdjustedRunwayMonths: 5.5,
    })
    expect(collection.facts.receivablesPayables).toMatchObject({
      netPosition: 9000,
    })
  })

  it('deduplicates identical values and never carries older gaps forward', () => {
    const older = [
      observation({ id: 'cash-old', documentId: 'doc-1', metricKey: 'cash', value: 100000, date: '2026-05-31' }),
      observation({ id: 'ar-old', documentId: 'doc-1', metricKey: 'accounts_receivable', value: 20000, date: '2026-05-31' }),
      observation({ id: 'ap-old', documentId: 'doc-1', metricKey: 'accounts_payable', value: 10000, date: '2026-05-31' }),
      observation({ id: 'burn-old', documentId: 'doc-1', metricKey: 'burn_rate', value: 20000, date: '2026-05-31' }),
    ]
    const latest = [
      observation({ id: 'cash-latest', documentId: 'doc-2', metricKey: 'cash', value: 90000, date: '2026-06-30' }),
      observation({ id: 'burn-latest', documentId: 'doc-2', metricKey: 'burn_rate', value: 18000, date: '2026-06-30' }),
      observation({ id: 'revenue-latest', documentId: 'doc-2', metricKey: 'monthly_revenue', value: 60000, date: '2026-06-30' }),
      observation({ id: 'expenses-latest', documentId: 'doc-2', metricKey: 'monthly_expenses', value: 55000, date: '2026-06-30' }),
      observation({ id: 'expenses-duplicate', documentId: 'doc-1', metricKey: 'monthly_expenses', value: 55000, date: '2026-06-30' }),
    ]

    const collection = collectFinancialAnalysisFromObservations({
      request: {
        mode: 'timeline',
        sourceKeys,
        currency: 'NZD',
        asOfDate: '2026-06-30',
        conflictResolutions: {},
      },
      observations: [...older, ...latest],
    })

    expect(collection.selection).toMatchObject({
      mode: 'timeline',
      reportingPeriodStart: '2026-05-31',
      reportingPeriodEnd: '2026-06-30',
      reportDate: '2026-06-30',
    })
    expect(collection.facts.runway).toMatchObject({
      cashRunwayMonths: 5,
      workingCapitalAdjustedRunwayMonths: null,
    })
    expect(collection.facts.receivablesPayables).toBeNull()
    expect(collection.facts.periodComparisons).toHaveLength(8)
    expect(collection.facts.periodComparisons.find((item) => item.metricKey === 'accounts_receivable'))
      .toMatchObject({ latest: null, startToLatestChange: null })
    expect(collection.evidence.filter((item) => item.metricKey === 'monthly_expenses'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ resolution: 'identical_duplicate', usedInCalculations: true }),
        expect.objectContaining({ resolution: 'identical_duplicate', usedInCalculations: true }),
      ]))
  })

  it('rejects mixed-currency rows and unowned source selections', () => {
    const observations = [
      observation({ id: 'cash-nzd', documentId: 'doc-1', metricKey: 'cash', value: 90000, date: '2026-06-30' }),
      observation({ id: 'cash-aud', documentId: 'doc-2', metricKey: 'cash', value: 85000, date: '2026-06-30', currency: 'AUD' }),
    ]

    expect(() => previewFinancialAnalysisTimeline({
      request: { mode: 'timeline', sourceKeys, currency: 'NZD' },
      observations,
    })).toThrow('has no NZD observations')

    expect(() => previewFinancialAnalysisTimeline({
      request: {
        mode: 'timeline',
        sourceKeys: ['document:doc-1', 'document:not-owned'],
        currency: 'NZD',
      },
      observations,
    })).toThrow('unavailable or do not belong')
  })
})
