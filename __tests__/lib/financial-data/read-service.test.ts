import {
  buildRunwayInputFromMetrics,
  fillUnavailableMetrics,
  summarizeMetricAvailability,
  type FinancialMetricSet,
} from '@/lib/financial-data'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'

function createMetric(
  key: 'cash' | 'accounts_receivable' | 'accounts_payable' | 'burn_rate',
  value: number,
  currency: string | null = 'NZD'
) {
  return {
    status: 'available' as const,
    key,
    value,
    currency,
    periodStart: null,
    periodEnd: null,
    asOfDate: '2026-05-12',
    provenance: {
      sourceType: 'document' as const,
      sourceLabel: 'summary.csv',
      sourceId: 'document-123',
    },
    confidence: 0.95,
    updatedAt: '2026-05-12T00:00:00.000Z',
  }
}

describe('financial data read service helpers', () => {
  it('fills missing canonical metrics with explicit unavailable values', () => {
    const metrics = fillUnavailableMetrics({
      cash: createMetric('cash', 120000),
    })

    expect(metrics.cash).toMatchObject({
      status: 'available',
      key: 'cash',
      value: 120000,
    })
    expect(metrics.accounts_receivable).toEqual({
      status: 'unavailable',
      key: 'accounts_receivable',
      reason: 'not_provided',
      sourceType: null,
      sourceLabel: null,
      updatedAt: null,
    })
    expect(Object.keys(metrics)).toEqual([...FINANCIAL_METRIC_KEYS])
  })

  it('summarizes available and unavailable metric counts', () => {
    const metrics = fillUnavailableMetrics({
      cash: createMetric('cash', 120000),
      burn_rate: createMetric('burn_rate', 28000),
    })

    expect(summarizeMetricAvailability(metrics)).toEqual({
      availableMetricCount: 2,
      unavailableMetricCount: FINANCIAL_METRIC_KEYS.length - 2,
    })
  })

  it('builds runway input only when all required metrics are available', () => {
    const completeMetrics: FinancialMetricSet = {
      cash: createMetric('cash', 120000),
      accounts_receivable: createMetric('accounts_receivable', 45000),
      accounts_payable: createMetric('accounts_payable', 21000),
      burn_rate: createMetric('burn_rate', 28000),
    }

    expect(buildRunwayInputFromMetrics(completeMetrics)).toEqual({
      cash: 120000,
      ar: 45000,
      ap: 21000,
      burn: 28000,
    })

    expect(
      buildRunwayInputFromMetrics({
        cash: createMetric('cash', 120000),
      })
    ).toBeNull()
  })

  it('does not combine missing, unsupported, or mixed currencies for runway', () => {
    const completeMetrics = {
      cash: createMetric('cash', 120000),
      accounts_receivable: createMetric('accounts_receivable', 45000),
      accounts_payable: createMetric('accounts_payable', 21000),
      burn_rate: createMetric('burn_rate', 28000),
    }

    expect(
      buildRunwayInputFromMetrics({
        ...completeMetrics,
        burn_rate: createMetric('burn_rate', 28000, 'AUD'),
      })
    ).toBeNull()
    expect(
      buildRunwayInputFromMetrics({
        ...completeMetrics,
        burn_rate: createMetric('burn_rate', 28000, 'USD'),
      })
    ).toBeNull()
    expect(
      buildRunwayInputFromMetrics({
        ...completeMetrics,
        burn_rate: createMetric('burn_rate', 28000, null),
      })
    ).toBeNull()
  })
})
