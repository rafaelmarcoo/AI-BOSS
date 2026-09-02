import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { fillUnavailableMetrics } from '@/lib/financial-data/read-model'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { createModelScenarioTool } from '@/lib/tools/financial/model-scenario'
import type { FinancialMetricSet } from '@/lib/financial-data/types'
import { analyseScenario, listScenarioBaselineOptions } from '@/lib/scenarios/service'

jest.mock('@/lib/financial-data/read-service', () => ({
  readSourceAwareMetrics: jest.fn(),
}))
jest.mock('@/lib/scenarios/service', () => ({
  analyseScenario: jest.fn(),
  listScenarioBaselineOptions: jest.fn(),
}))

const mockReadSourceAwareMetrics = jest.mocked(readSourceAwareMetrics)
const mockAnalyseScenario = jest.mocked(analyseScenario)
const mockListScenarioBaselineOptions = jest.mocked(listScenarioBaselineOptions)

const scenarioInput = {
  horizon: 3 as const,
  trendRange: '6m' as const,
  manualBaseline: {},
  scenarios: [{ id: 'hire', label: 'New hire', adjustments: [{
    id: 'cost', label: 'Employer cost', kind: 'fixed' as const,
    flow: 'outflow' as const, frequency: 'recurring' as const,
    amount: 9000, startMonth: '2026-06',
  }] }],
}

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
    workingCapitalAdjustedRunway: metrics.runway_months,
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
      workingCapitalAdjustedRunway: metrics.runway_months,
    })

    await expect(
      createGetLatestSnapshotTool('user-123').handler({})
    ).resolves.toContain('No financial metrics are available yet')
  })

  it('forbids a numerical adjusted-runway result when inputs are incompatible', async () => {
    const result = availableMetrics()
    mockReadSourceAwareMetrics.mockResolvedValue({
      ...result,
      runwayInput: null,
      workingCapitalAdjustedRunway: {
        status: 'unavailable',
        key: 'runway_months',
        reason: 'incompatible_reporting_date',
        sourceType: null,
        sourceLabel: null,
        updatedAt: null,
        detail:
          'Cannot calculate working-capital-adjusted runway because accounts receivable for 2026-05-31 was explicitly excluded during document review.',
      },
    })

    const output = await createGetLatestSnapshotTool('user-123').handler({})

    expect(output).toContain(
      'Working-capital-adjusted runway status: UNAVAILABLE'
    )
    expect(output).toContain('show the symbolic formula only')
    expect(output).toContain('Do not substitute mismatched values')
    expect(output).not.toContain('Confirmed runway inputs:')
  })

  it('model_scenario resolves one owned source and returns the deterministic result', async () => {
    mockListScenarioBaselineOptions.mockResolvedValue([{
      sourceKey: 'document:doc-1', sourceLabel: 'demo.csv', sourceType: 'document',
      currency: 'NZD', availableMetrics: ['cash'], latestReportingDate: '2026-05-31', cashObservationCount: 3, metrics: {},
    }])
    mockAnalyseScenario.mockResolvedValue({ sourceLabel: 'demo.csv' } as never)

    const result = await createModelScenarioTool('user-123').handler(scenarioInput)

    expect(result.status).toBe('ready')
    expect(mockAnalyseScenario).toHaveBeenCalledWith('user-123', expect.objectContaining({
      sourceKey: 'document:doc-1', currency: 'NZD',
    }))
  })

  it('model_scenario requests a source/currency when choices are ambiguous', async () => {
    mockListScenarioBaselineOptions.mockResolvedValue([
      { sourceKey: 'document:nzd', sourceLabel: 'nzd.csv', sourceType: 'document', currency: 'NZD', availableMetrics: ['cash'], latestReportingDate: '2026-05-31', cashObservationCount: 3, metrics: {} },
      { sourceKey: 'document:aud', sourceLabel: 'aud.csv', sourceType: 'document', currency: 'AUD', availableMetrics: ['cash'], latestReportingDate: '2026-05-31', cashObservationCount: 3, metrics: {} },
    ])

    const result = await createModelScenarioTool('user-123').handler(scenarioInput)
    expect(result).toMatchObject({ status: 'needs_input', field: 'source_currency' })
  })

  it('models a removed recurring employee cost as a saving for a firing scenario', async () => {
    mockListScenarioBaselineOptions.mockResolvedValue([{
      sourceKey: 'document:doc-1', sourceLabel: 'demo.csv', sourceType: 'document',
      currency: 'NZD', availableMetrics: ['cash'], latestReportingDate: '2026-05-31', cashObservationCount: 3, metrics: {},
    }])
    mockAnalyseScenario.mockResolvedValue({ sourceLabel: 'demo.csv' } as never)

    await createModelScenarioTool('user-123').handler({
      ...scenarioInput,
      scenarios: [{
        id: 'fire', label: 'Firing Employee', adjustments: [{
          id: 'saving', label: 'Monthly employee cost', kind: 'fixed',
          flow: 'outflow', frequency: 'recurring', amount: 6600, startMonth: '2026-06',
        }],
      }],
    })

    expect(mockAnalyseScenario).toHaveBeenCalledWith('user-123', expect.objectContaining({
      scenarios: [expect.objectContaining({
        adjustments: [expect.objectContaining({ flow: 'inflow', amount: 6600 })],
      })],
    }))
  })

  it('model_scenario returns deterministic validation failures as focused missing input', async () => {
    mockListScenarioBaselineOptions.mockResolvedValue([{
      sourceKey: 'document:doc-1', sourceLabel: 'demo.csv', sourceType: 'document',
      currency: 'NZD', availableMetrics: ['cash'], latestReportingDate: '2026-05-31', cashObservationCount: 3, metrics: {},
    }])
    mockAnalyseScenario.mockRejectedValue(new Error('Accounts payable is required.'))

    await expect(createModelScenarioTool('user-123').handler(scenarioInput)).resolves.toMatchObject({
      status: 'needs_input', field: 'baseline', message: 'Accounts payable is required.',
    })
  })
})
