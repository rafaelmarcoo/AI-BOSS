import {
  createUnavailableMetric,
  getMetricNumber,
  isAvailableMetric,
  isFinancialMetricKey,
  isUnavailableMetric,
  type FinancialMetricSet,
  type FinancialMetricValue,
} from '@/lib/financial-data'

describe('financial metric domain model', () => {
  it('recognizes canonical financial metric keys', () => {
    expect(isFinancialMetricKey('cash')).toBe(true)
    expect(isFinancialMetricKey('runway_months')).toBe(true)
    expect(isFinancialMetricKey('cash_balance')).toBe(false)
  })

  it('creates explicit unavailable metric values', () => {
    const metric = createUnavailableMetric({
      key: 'monthly_revenue',
      reason: 'not_extracted',
      sourceType: 'document',
      sourceLabel: 'Uploaded CSV',
    })

    expect(metric).toEqual({
      status: 'unavailable',
      key: 'monthly_revenue',
      reason: 'not_extracted',
      sourceType: 'document',
      sourceLabel: 'Uploaded CSV',
      updatedAt: null,
    })
    expect(isUnavailableMetric(metric)).toBe(true)
    expect(isAvailableMetric(metric)).toBe(false)
  })

  it('reads numeric values only from available metrics', () => {
    const metrics: FinancialMetricSet = {
      cash: {
        status: 'available',
        key: 'cash',
        value: 250000,
        currency: 'NZD',
        periodStart: null,
        periodEnd: null,
        asOfDate: '2026-05-12',
        provenance: {
          sourceType: 'xero',
          sourceLabel: 'Xero',
          sourceId: 'connection-123',
        },
        confidence: 1,
        updatedAt: '2026-05-12T00:00:00.000Z',
      },
      burn_rate: createUnavailableMetric({
        key: 'burn_rate',
        reason: 'insufficient_data',
      }),
    }

    expect(getMetricNumber(metrics, 'cash')).toBe(250000)
    expect(getMetricNumber(metrics, 'burn_rate')).toBeNull()
    expect(getMetricNumber(metrics, 'runway_months')).toBeNull()
  })

  it('narrows available metrics for provenance-aware consumers', () => {
    const metric: FinancialMetricValue = {
      status: 'available',
      key: 'accounts_receivable',
      value: 42000,
      currency: 'NZD',
      periodStart: null,
      periodEnd: null,
      asOfDate: '2026-05-12',
      provenance: {
        sourceType: 'document',
        sourceLabel: 'April management report.pdf',
        evidence: {
          documentId: 'document-123',
          sourcePage: 4,
          excerpt: 'Accounts receivable 42,000',
        },
      },
      confidence: 0.86,
      updatedAt: '2026-05-12T00:00:00.000Z',
    }

    expect(isAvailableMetric(metric)).toBe(true)

    if (isAvailableMetric(metric)) {
      expect(metric.provenance.sourceType).toBe('document')
      expect(metric.provenance.evidence?.sourcePage).toBe(4)
    }
  })
})
