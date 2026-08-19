import { createAdminSupabaseClient } from '@/lib/supabase'
import { listFinancialMetricObservations } from '@/lib/financial-data/persistence'
import { getSavedScenario, updateSavedScenario } from '@/lib/scenarios/persistence'
import type { FinancialMetricObservation, SavedScenario } from '@/types/database'

jest.mock('@/lib/supabase', () => ({ createAdminSupabaseClient: jest.fn() }))
jest.mock('@/lib/financial-data/persistence', () => ({ listFinancialMetricObservations: jest.fn() }))

const mockCreateAdminClient = jest.mocked(createAdminSupabaseClient)
const mockListObservations = jest.mocked(listFinancialMetricObservations)

const saved: SavedScenario = {
  id: 'scenario-1', user_id: 'owner-1', company_id: 'company-1', name: 'Hiring plan', description: null,
  status: 'calculated', visibility: 'company',
  input_payload: {
    sourceKey: 'document:doc-1', currency: 'NZD', horizon: 3, trendRange: '6m', manualBaseline: {},
    scenarios: [{ id: 'hire', label: 'Hire', adjustments: [{
      id: 'cost', label: 'Employer cost', kind: 'fixed', flow: 'outflow', frequency: 'recurring', amount: 8000, startMonth: '2026-06',
    }] }],
  },
  result_payload: { input: {}, currency: 'NZD' } as never,
  baseline_fingerprint: [{ id: 'cash-1', updatedAt: '2026-05-31T00:00:00Z' }],
  calculated_at: '2026-06-01T00:00:00Z', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
}

function observation(metric_key: FinancialMetricObservation['metric_key'], id: string, updated_at: string): FinancialMetricObservation {
  return {
    id, user_id: 'owner-1', connection_id: null, document_id: 'doc-1', metric_key, value: 100000,
    currency: 'NZD', period_start: null, period_end: null, as_of_date: '2026-05-31', source_type: 'document',
    source_label: 'statement.csv', confidence: 0.95, evidence: {}, raw_data: {}, created_at: updated_at, updated_at,
  }
}

function query(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), ilike: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: result, error: null }),
  }
}

function installDatabase(scenario: SavedScenario = saved) {
  const users = query({ company_name: 'Example Ltd' })
  const companies = query({ id: 'company-1' })
  const scenarios = query(scenario)
  mockCreateAdminClient.mockReturnValue({
    from: jest.fn((table: string) => ({ users, companies, scenarios }[table])),
  } as never)
}

describe('saved scenario persistence authorization and staleness', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    installDatabase()
  })

  it('detects relevant observation changes but ignores unrelated metrics', async () => {
    mockListObservations.mockResolvedValue([
      observation('cash', 'cash-1', '2026-05-31T00:00:00Z'),
      observation('runway_months', 'runway-1', '2026-06-01T00:00:00Z'),
    ])
    await expect(getSavedScenario('scenario-1', 'owner-1')).resolves.toMatchObject({ isStale: false })

    mockListObservations.mockResolvedValue([
      observation('cash', 'cash-1', '2026-06-02T00:00:00Z'),
    ])
    await expect(getSavedScenario('scenario-1', 'owner-1')).resolves.toMatchObject({ isStale: true })
  })

  it('prevents a company viewer from editing the shared original', async () => {
    await expect(updateSavedScenario('scenario-1', 'viewer-1', {
      name: 'Changed', status: 'calculated', visibility: 'company', input: saved.input_payload,
    })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})
