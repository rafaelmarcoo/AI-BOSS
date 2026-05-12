import {
  createUnavailableMetric,
  getMetricNumber,
  isAvailableMetric,
  isFinancialMetricKey,
  isUnavailableMetric,
  type FinancialMetricSet,
  type FinancialMetricValue,
} from '@/lib/financial-data'
import { mapObservationRowToMetric } from '@/lib/financial-data/observation-mapping'
import type { FinancialMetricObservation } from '@/types/database'

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

  it('maps database observation rows to shared metric values', () => {
    const row: FinancialMetricObservation = {
      id: 'observation-123',
      user_id: 'user-123',
      connection_id: null,
      document_id: 'document-123',
      metric_key: 'monthly_expenses',
      value: 18500,
      currency: 'NZD',
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      as_of_date: null,
      source_type: 'document',
      source_label: 'April P&L.csv',
      confidence: 0.92,
      evidence: {
        documentId: 'document-123',
        sourceRowStart: 2,
        sourceRowEnd: 20,
      },
      raw_data: {},
      created_at: '2026-05-12T00:00:00.000Z',
      updated_at: '2026-05-12T01:00:00.000Z',
    }

    expect(mapObservationRowToMetric(row)).toEqual({
      status: 'available',
      key: 'monthly_expenses',
      value: 18500,
      currency: 'NZD',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      asOfDate: null,
      provenance: {
        sourceType: 'document',
        sourceLabel: 'April P&L.csv',
        sourceId: 'document-123',
        evidence: {
          documentId: 'document-123',
          sourceRowStart: 2,
          sourceRowEnd: 20,
        },
      },
      confidence: 0.92,
      updatedAt: '2026-05-12T01:00:00.000Z',
    })
  })
})
