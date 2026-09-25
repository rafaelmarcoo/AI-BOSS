import { listFinancialMetricObservations } from '@/lib/financial-data/persistence'
import { getFinancialAnalysisRun } from '@/lib/financial-analysis/persistence'
import { analyseScenario, listScenarioBaselineOptions } from '@/lib/scenarios/service'
import { ApiError } from '@/lib/api/errors'
import type { FinancialMetricObservation } from '@/types/database'

jest.mock('@/lib/financial-data/persistence', () => ({
  listFinancialMetricObservations: jest.fn(),
}))
jest.mock('@/lib/financial-analysis/persistence', () => ({
  getFinancialAnalysisRun: jest.fn(),
}))

const mockListObservations = jest.mocked(listFinancialMetricObservations)
const mockGetFinancialAnalysisRun = jest.mocked(getFinancialAnalysisRun)

function row(params: Partial<FinancialMetricObservation> & Pick<FinancialMetricObservation, 'id' | 'metric_key' | 'value'>): FinancialMetricObservation {
  return {
    user_id: 'user-1', connection_id: null, document_id: 'doc-1', currency: 'NZD',
    period_start: null, period_end: null, as_of_date: '2026-05-31', source_type: 'document',
    source_label: 'statement.csv', confidence: 0.95, evidence: {}, raw_data: {},
    created_at: '2026-05-31T00:00:00Z', updated_at: '2026-05-31T00:00:00Z',
    ...params,
  }
}

const observations = [
  row({ id: 'cash-mar', metric_key: 'cash', value: 120000, as_of_date: '2026-03-31' }),
  row({ id: 'cash-apr', metric_key: 'cash', value: 110000, as_of_date: '2026-04-30' }),
  row({ id: 'cash-may', metric_key: 'cash', value: 100000 }),
  row({ id: 'ar', metric_key: 'accounts_receivable', value: 20000 }),
  row({ id: 'ap', metric_key: 'accounts_payable', value: 10000 }),
  row({ id: 'burn', metric_key: 'burn_rate', value: 10000 }),
]

describe('scenario source service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListObservations.mockResolvedValue(observations)
  })

  it('groups baseline options by source and supported currency', async () => {
    const options = await listScenarioBaselineOptions('user-1')
    expect(options).toEqual([
      expect.objectContaining({
        sourceKey: 'document:doc-1',
        currency: 'NZD',
        sourceLabel: 'statement.csv',
        cashObservationCount: 3,
        metrics: expect.objectContaining({ cash: expect.objectContaining({ value: 100000 }) }),
      }),
    ])
  })

  it('loads one source/currency and applies manual values without persisting them', async () => {
    const result = await analyseScenario('user-1', {
      sourceKey: 'document:doc-1', currency: 'NZD', horizon: 3, trendRange: '6m',
      manualBaseline: { burnRate: 12000 },
      scenarios: [{ id: 'hire', label: 'Hire', adjustments: [{
        id: 'cost', label: 'Cost', kind: 'fixed', flow: 'outflow', frequency: 'recurring',
        amount: 5000, startMonth: '2026-06',
      }] }],
    })
    expect(result.metricInputs.burnRate?.origin).toBe('manual')
    expect(result.panels[0].baselineMonthlyMovement).toBe(-12000)
    expect(result.panels[1].available).toBe(true)
  })

  it('keeps repeated stored values verified instead of treating them as manual overrides', async () => {
    const result = await analyseScenario('user-1', {
      sourceKey: 'document:doc-1', currency: 'NZD', horizon: 3, trendRange: '6m',
      manualBaseline: {
        cash: 100000,
        accountsReceivable: 20000,
        accountsPayable: 10000,
        burnRate: 10000,
        asOfMonth: '2026-05',
      },
      scenarios: [{ id: 'hire', label: 'Hire', adjustments: [{
        id: 'cost', label: 'Cost', kind: 'fixed', flow: 'outflow', frequency: 'recurring',
        amount: 5000, startMonth: '2026-06',
      }] }],
    })

    expect(result.metricInputs.cash?.origin).toBe('verified')
    expect(result.metricInputs.burnRate?.origin).toBe('verified')
    expect(result.warnings.join(' ')).not.toContain('unverified manual')
  })

  it('does not use another currency or source', async () => {
    await expect(analyseScenario('user-1', {
      sourceKey: 'document:other', currency: 'AUD', horizon: 3, trendRange: '6m',
      manualBaseline: {}, scenarios: [{ id: 'x', label: 'X', adjustments: [{
        id: 'y', label: 'Y', kind: 'fixed', flow: 'inflow', frequency: 'one_off', amount: 1,
        startMonth: '2026-06',
      }] }],
    })).rejects.toThrow('unavailable or do not belong')
  })

  it('loads a frozen owner-bound analysis report without rereading source observations', async () => {
    mockGetFinancialAnalysisRun.mockResolvedValue({
      id: 'analysis-1',
      createdAt: '2026-07-01T00:00:00.000Z',
      result: {
        selectedBaseline: {
          currency: 'NZD',
          reportDate: '2026-06-30',
          sources: [{ sourceLabel: 'june.csv' }],
        },
        evidence: [
          ['cash', 90000, 'cash-1'],
          ['accounts_receivable', 12000, 'ar-1'],
          ['accounts_payable', 3000, 'ap-1'],
          ['burn_rate', 18000, 'burn-1'],
          ['monthly_revenue', 60000, 'revenue-1'],
          ['monthly_expenses', 55000, 'expenses-1'],
        ].map(([metricKey, value, observationId]) => ({
          metricKey,
          value,
          observationId,
          reportingDate: '2026-06-30',
          usedInCalculations: true,
          resolution: 'uncontested',
          sourceLabel: 'june.csv',
          confidence: 0.95,
        })),
        facts: {
          history: [{ metricKey: 'cash', observationCount: 3 }],
          forecasts: [{ metricKey: 'cash', monthlySlope: -5000 }],
        },
      },
    } as never)

    const result = await analyseScenario('user-1', {
      version: 'scenario-analysis-v2',
      baseline: { kind: 'analysis_run', analysisRunId: 'analysis-1' },
      currency: 'NZD',
      horizon: 3,
      trendRange: '6m',
      manualBaseline: {},
      scenarios: [{ id: 'hire', label: 'Hire', adjustments: [{
        id: 'cost', label: 'Cost', kind: 'fixed', flow: 'outflow', frequency: 'recurring',
        amount: 5000, startMonth: '2026-07',
      }] }],
    })

    expect(mockGetFinancialAnalysisRun).toHaveBeenCalledWith('analysis-1', 'user-1')
    expect(mockListObservations).not.toHaveBeenCalled()
    expect(result.sourceKey).toBe('analysis-run:analysis-1')
    expect(result.metricInputs.cash).toMatchObject({
      value: 90000,
      origin: 'analysis_snapshot',
      reportingDate: '2026-06-30',
    })
    expect(result.metricInputs.historicalMonthlyCashSlope).toBe(-5000)
    expect(result.panels[1].baselineMonthlyMovement).toBe(-5000)
  })

  it('keeps report values frozen while clearly marking a manual override', async () => {
    mockGetFinancialAnalysisRun.mockResolvedValue({
      id: 'analysis-1',
      createdAt: '2026-07-01T00:00:00.000Z',
      result: {
        selectedBaseline: {
          currency: 'NZD', reportDate: '2026-06-30', sources: [],
        },
        evidence: [
          ['cash', 90000, 'cash-1'],
          ['accounts_receivable', 12000, 'ar-1'],
          ['accounts_payable', 3000, 'ap-1'],
        ].map(([metricKey, value, observationId]) => ({
          metricKey, value, observationId,
          reportingDate: '2026-06-30', usedInCalculations: true,
          resolution: 'uncontested', sourceLabel: 'report', confidence: 1,
        })),
        facts: { history: [], forecasts: [] },
      },
    } as never)

    const result = await analyseScenario('user-1', {
      version: 'scenario-analysis-v2',
      baseline: { kind: 'analysis_run', analysisRunId: 'analysis-1' },
      currency: 'NZD', horizon: 3, trendRange: '6m',
      manualBaseline: { accountsReceivable: 15000 },
      scenarios: [{ id: 'x', label: 'X', adjustments: [{
        id: 'y', label: 'Y', kind: 'fixed', flow: 'inflow', frequency: 'one_off',
        amount: 1, startMonth: '2026-07',
      }] }],
    })

    expect(result.metricInputs.cash?.origin).toBe('analysis_snapshot')
    expect(result.metricInputs.accountsReceivable).toMatchObject({
      value: 15000,
      origin: 'manual',
    })
    expect(result.warnings.join(' ')).toContain('manual scenario assumptions')
  })

  it('uses the frozen report date for missing values supplied as assumptions', async () => {
    mockGetFinancialAnalysisRun.mockResolvedValue({
      id: 'analysis-1',
      createdAt: '2026-07-01T00:00:00.000Z',
      result: {
        selectedBaseline: {
          currency: 'NZD', reportDate: '2026-06-30', sources: [],
        },
        evidence: [{
          metricKey: 'cash', value: 90000, observationId: 'cash-1',
          reportingDate: '2026-06-30', usedInCalculations: true,
          resolution: 'uncontested', sourceLabel: 'report', confidence: 1,
        }],
        facts: { history: [], forecasts: [] },
      },
    } as never)

    const result = await analyseScenario('user-1', {
      version: 'scenario-analysis-v2',
      baseline: { kind: 'analysis_run', analysisRunId: 'analysis-1' },
      currency: 'NZD', horizon: 3, trendRange: '6m',
      manualBaseline: { accountsReceivable: 12000, accountsPayable: 3000 },
      scenarios: [{ id: 'x', label: 'X', adjustments: [{
        id: 'y', label: 'Y', kind: 'fixed', flow: 'inflow', frequency: 'one_off',
        amount: 1, startMonth: '2026-07',
      }] }],
    })

    expect(result.openingLiquidity).toBe(99000)
    expect(result.metricInputs.accountsReceivable).toMatchObject({
      origin: 'manual', reportingDate: '2026-06-30',
    })
    expect(result.metricInputs.accountsPayable).toMatchObject({
      origin: 'manual', reportingDate: '2026-06-30',
    })
  })

  it('preserves the report ownership boundary for frozen baselines', async () => {
    mockGetFinancialAnalysisRun.mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Financial analysis report not found.')
    )

    await expect(analyseScenario('viewer-1', {
      version: 'scenario-analysis-v2',
      baseline: { kind: 'analysis_run', analysisRunId: 'analysis-private' },
      currency: 'NZD',
      horizon: 3,
      trendRange: '6m',
      manualBaseline: {},
      scenarios: [{ id: 'x', label: 'X', adjustments: [{
        id: 'y', label: 'Y', kind: 'fixed', flow: 'inflow', frequency: 'one_off',
        amount: 1, startMonth: '2026-07',
      }] }],
    })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })

    expect(mockGetFinancialAnalysisRun).toHaveBeenCalledWith(
      'analysis-private',
      'viewer-1'
    )
    expect(mockListObservations).not.toHaveBeenCalled()
  })
})
