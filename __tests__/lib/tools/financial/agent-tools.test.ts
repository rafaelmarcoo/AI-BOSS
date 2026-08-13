import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { createModelScenarioTool } from '@/lib/tools/financial/model-scenario'
import type { FinancialMetricSet } from '@/lib/financial-data/types'

jest.mock('@/lib/financial-data/read-service', () => ({
  readSourceAwareMetrics: jest.fn(),
}))

const mockReadSourceAwareMetrics = jest.mocked(readSourceAwareMetrics)

function availableMetrics(overrides: FinancialMetricSet = {}) {
  const metrics = fillUnavailableMetrics({
    cash: {
      status: 'available',
      key: 'cash',
      value: 120000,
      currency: 'NZD',
      periodStart: null,
      periodEnd: null,
      asOfDate: '2026-05-12',
      provenance: {
        sourceType: 'document',
        sourceLabel: 'demo.csv',
      },
      confidence: 0.95,
      updatedAt: '2026-05-12T00:00:00.000Z',
    },
    accounts_receivable: {
      status: 'available',
      key: 'accounts_receivable',
      value: 45000,
      currency: 'NZD',
      periodStart: null,
      periodEnd: null,
      asOfDate: '2026-05-12',
      provenance: {
        sourceType: 'document',
        sourceLabel: 'demo.csv',
      },
      confidence: 0.95,
      updatedAt: '2026-05-12T00:00:00.000Z',
    },
    accounts_payable: {
      status: 'available',
      key: 'accounts_payable',
      value: 21000,
      currency: 'NZD',
      periodStart: null,
      periodEnd: null,
      asOfDate: '2026-05-12',
      provenance: {
        sourceType: 'document',
        sourceLabel: 'demo.csv',
      },
      confidence: 0.95,
      updatedAt: '2026-05-12T00:00:00.000Z',
    },
    burn_rate: {
      status: 'available',
      key: 'burn_rate',
      value: 28000,
      currency: 'NZD',
      periodStart: null,
      periodEnd: '2026-04-30',
      asOfDate: null,
      provenance: {
        sourceType: 'document',
        sourceLabel: 'demo.csv',
      },
      confidence: 0.95,
      updatedAt: '2026-05-12T00:00:00.000Z',
    },
    ...overrides,
  })

  return {
    metrics,
    availableMetricCount: Object.values(metrics).filter(
      (metric) => metric.status === 'available'
    ).length,
    unavailableMetricCount: Object.values(metrics).filter(
      (metric) => metric.status === 'unavailable'
    ).length,
    runwayInput: {
      cash: 120000,
      ar: 45000,
      ap: 21000,
      burn: 28000,
    },
  }
}

describe('financial agent tools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('get_latest_snapshot returns available source-aware metrics', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(availableMetrics())

    const result = await createGetLatestSnapshotTool('user-123').handler({})

    expect(result).toContain('Financial snapshot')
    expect(result).toContain('cash: 120000 NZD')
    expect(result).toContain('source: demo.csv')
    expect(result).toContain('cash=120000, ar=45000, ap=21000, burn=28000')
    expect(mockReadSourceAwareMetrics).toHaveBeenCalledWith('user-123')
  })

  it('get_latest_snapshot explains when no metrics are available', async () => {
    const metrics = fillUnavailableMetrics({})
    mockReadSourceAwareMetrics.mockResolvedValue({
      metrics,
      availableMetricCount: 0,
      unavailableMetricCount: 7,
      runwayInput: null,
    })

    await expect(
      createGetLatestSnapshotTool('user-123').handler({})
    ).resolves.toContain('No financial metrics are available yet')
  })

  it('model_scenario compares before and after runway', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(availableMetrics())

    const result = await createModelScenarioTool('user-123').handler({
      label: 'new hire',
      monthly_cost_change: 9000,
    })

    expect(result).toContain('Scenario: new hire')
    expect(result).toContain('Before: 5.14 months')
    expect(result).toContain('After: 3.89 months')
    expect(result).toContain('Stored financial data has not been changed')
  })

  it('model_scenario handles incomplete runway inputs', async () => {
    const metrics = fillUnavailableMetrics({})
    mockReadSourceAwareMetrics.mockResolvedValue({
      metrics,
      availableMetricCount: 0,
      unavailableMetricCount: 7,
      runwayInput: null,
    })

    await expect(
      createModelScenarioTool('user-123').handler({
        label: 'new hire',
        monthly_cost_change: 9000,
      })
    ).resolves.toContain('current runway inputs are incomplete')
  })

  it('model_scenario rejects scenarios with non-positive resulting burn', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(availableMetrics())

    await expect(
      createModelScenarioTool('user-123').handler({
        label: 'large saving',
        monthly_cost_change: -28000,
      })
    ).resolves.toContain('resulting monthly burn would be 0')
  })

  it('does not model a scenario from missing or mixed-currency runway inputs', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(
      availableMetrics({
        burn_rate: {
          status: 'available',
          key: 'burn_rate',
          value: 28000,
          currency: 'AUD',
          periodStart: null,
          periodEnd: '2026-04-30',
          asOfDate: null,
          provenance: { sourceType: 'document', sourceLabel: 'aud-demo.csv' },
          confidence: 0.95,
          updatedAt: '2026-05-12T00:00:00.000Z',
        },
      })
    )

    await expect(
      createModelScenarioTool('user-123').handler({
        label: 'new hire',
        monthly_cost_change: 9000,
      })
    ).resolves.toContain('one confirmed currency')
  })

  it('calculates an explicit burn percentage in trusted code', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(availableMetrics())

    const result = await createModelScenarioTool('user-123').handler({
      label: 'reduce burn',
      burn_percentage_change: -20,
    })

    expect(result).toContain('-5,600 NZD/month')
    expect(result).toContain('-20% of current burn')
    expect(result).toContain('5.14 months runway')
    expect(result).toContain('6.43 months runway')
  })

  it('rejects an ambiguous or unsupported scenario input shape', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(availableMetrics())

    await expect(
      createModelScenarioTool('user-123').handler({ label: 'ambiguous' })
    ).resolves.toContain('exactly one scenario change')
  })
})
