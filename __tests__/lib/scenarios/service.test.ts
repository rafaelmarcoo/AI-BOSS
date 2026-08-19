import { listFinancialMetricObservations } from '@/lib/financial-data/persistence'
import { analyseScenario, listScenarioBaselineOptions } from '@/lib/scenarios/service'
import type { FinancialMetricObservation } from '@/types/database'

jest.mock('@/lib/financial-data/persistence', () => ({
  listFinancialMetricObservations: jest.fn(),
}))

const mockListObservations = jest.mocked(listFinancialMetricObservations)

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
  beforeEach(() => mockListObservations.mockResolvedValue(observations))

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
})
