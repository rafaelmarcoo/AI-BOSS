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

    expect(result).toContain('4 metric(s) available')
    expect(result).toContain('cash: 120000 NZD')
    expect(result).toContain('source: demo.csv')
    // The tool must hand the agent the confirmed runway inputs so it can
    // call calculate_runway without inventing values.
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
    ).resolves.toContain('No financial data found')
  })

  it('model_scenario compares before and after runway', async () => {
    mockReadSourceAwareMetrics.mockResolvedValue(availableMetrics())

    const result = await createModelScenarioTool('user-123').handler({
      label: 'new hire',
      monthly_cost_change: 9000,
    })

    expect(result).toContain('new hire')
    // Assert the calculated figures rather than the surrounding label text,
    // so wording and column alignment can change without breaking the test.
    expect(result).toContain('5.14 months')
    expect(result).toContain('3.89 months')
    expect(result).toContain('has not been changed')
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
    ).resolves.toContain('financial data is incomplete')
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
})
