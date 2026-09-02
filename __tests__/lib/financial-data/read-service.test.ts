import {
  buildCalculatedRunwayMetric,
  buildRunwayInputFromMetrics,
  buildUnavailableRunwayMetric,
  buildWorkingCapitalAdjustedRunwayMetric,
  fillUnavailableMetrics,
  summarizeMetricAvailability,
  type FinancialMetricSet,
} from '@/lib/financial-data'

function createMetric(
  key: 'cash' | 'accounts_receivable' | 'accounts_payable' | 'burn_rate',
  value: number,
  currency: string | null = 'NZD',
  overrides: {
    sourceLabel?: string
    sourceId?: string
    asOfDate?: string | null
  } = {}
) {
  return {
    status: 'available' as const,
    key,
    value,
    currency,
    periodStart: null,
    periodEnd: null,
    asOfDate: overrides.asOfDate === undefined ? '2026-05-12' : overrides.asOfDate,
    provenance: {
      sourceType: 'document' as const,
      sourceLabel: overrides.sourceLabel ?? 'summary.csv',
      sourceId: overrides.sourceId ?? 'document-123',
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
    expect(Object.keys(metrics)).toEqual([
      'cash',
      'accounts_receivable',
      'accounts_payable',
      'monthly_revenue',
      'monthly_expenses',
      'burn_rate',
      'runway_months',
    ])
  })

  it('summarizes available and unavailable metric counts', () => {
    const metrics = fillUnavailableMetrics({
      cash: createMetric('cash', 120000),
      burn_rate: createMetric('burn_rate', 28000),
    })

    expect(summarizeMetricAvailability(metrics)).toEqual({
      availableMetricCount: 2,
      unavailableMetricCount: 5,
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

  it('does not silently combine runway inputs from different sources or dates', () => {
    const completeMetrics = {
      cash: createMetric('cash', 120000),
      accounts_receivable: createMetric('accounts_receivable', 45000),
      accounts_payable: createMetric('accounts_payable', 21000),
      burn_rate: createMetric('burn_rate', 28000),
    }

    expect(buildRunwayInputFromMetrics({
      ...completeMetrics,
      burn_rate: createMetric('burn_rate', 28000, 'NZD', {
        sourceLabel: 'other.csv',
        sourceId: 'document-456',
      }),
    })).toBeNull()

    expect(buildRunwayInputFromMetrics({
      ...completeMetrics,
      burn_rate: createMetric('burn_rate', 28000, 'NZD', {
        asOfDate: '2026-04-30',
      }),
    })).toBeNull()
  })

  it('explains why current runway cannot be calculated', () => {
    const completeMetrics = {
      cash: createMetric('cash', 120000),
      accounts_receivable: createMetric('accounts_receivable', 45000),
      accounts_payable: createMetric('accounts_payable', 21000),
      burn_rate: createMetric('burn_rate', 28000),
    }

    expect(buildUnavailableRunwayMetric({
      ...completeMetrics,
      burn_rate: createMetric('burn_rate', 28000, 'AUD'),
    })).toMatchObject({
      reason: 'incompatible_currency',
      detail: expect.stringContaining('same supported NZD or AUD currency'),
    })
    expect(buildUnavailableRunwayMetric({
      ...completeMetrics,
      burn_rate: createMetric('burn_rate', 28000, 'NZD', {
        sourceId: 'document-456',
      }),
    })).toMatchObject({
      reason: 'incompatible_source',
      detail: expect.stringContaining('different sources'),
    })
    expect(buildUnavailableRunwayMetric({
      ...completeMetrics,
      burn_rate: createMetric('burn_rate', 28000, 'NZD', {
        asOfDate: '2026-04-30',
      }),
    })).toMatchObject({
      reason: 'incompatible_reporting_date',
      detail: expect.stringContaining('one reporting date'),
    })
  })

  it('derives primary cash runway without creating a monetary runway value', () => {
    const metric = buildCalculatedRunwayMetric({
      cash: createMetric('cash', 80000),
      accounts_receivable: createMetric('accounts_receivable', 16000),
      accounts_payable: createMetric('accounts_payable', 14000),
      burn_rate: createMetric('burn_rate', 17000),
    })

    expect(metric).toMatchObject({
      status: 'available',
      key: 'runway_months',
      value: 4.71,
      currency: null,
      asOfDate: '2026-05-12',
      provenance: {
        sourceLabel: 'summary.csv (cash runway calculated)',
        evidence: {
          excerpt: '80000 / 17000 = 4.71 months',
        },
      },
    })
  })

  it('derives working-capital-adjusted runway as a separate view value', () => {
    expect(buildWorkingCapitalAdjustedRunwayMetric({
      cash: createMetric('cash', 80000),
      accounts_receivable: createMetric('accounts_receivable', 16000),
      accounts_payable: createMetric('accounts_payable', 14000),
      burn_rate: createMetric('burn_rate', 17000),
    })).toMatchObject({
      status: 'available',
      value: 4.82,
      currency: null,
      provenance: {
        sourceLabel:
          'summary.csv (working-capital-adjusted runway calculated)',
        evidence: {
          excerpt: '(80000 + 16000 - 14000) / 17000 = 4.82 months',
        },
      },
    })
  })

  it('keeps cash runway available when receivables or payables are missing', () => {
    const metrics = {
      cash: createMetric('cash', 80000),
      burn_rate: createMetric('burn_rate', 17000),
    }

    expect(buildCalculatedRunwayMetric(metrics)).toMatchObject({
      status: 'available',
      value: 4.71,
    })
    expect(buildWorkingCapitalAdjustedRunwayMetric(metrics)).toBeNull()
  })
})
