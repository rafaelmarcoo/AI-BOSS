import { createAdminSupabaseClient } from '@/lib/supabase'
import {
  deleteFinancialAnalysisRun,
  getFinancialAnalysisRun,
  listFinancialAnalysisRuns,
  saveFinancialAnalysisRun,
} from '@/lib/financial-analysis/persistence'
import {
  FINANCIAL_ANALYSIS_SECTION_IDS,
  normalizeFinancialAnalysisResult,
} from '@/lib/financial-analysis/types'
import type { FinancialAnalysisResultV1 } from '@/lib/financial-analysis/types'

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

const mockCreateAdminClient = jest.mocked(createAdminSupabaseClient)

const legacyResult: FinancialAnalysisResultV1 = {
  version: 'financial-analysis-v1',
  runStatus: 'complete',
  generatedAt: '2026-09-22T00:00:00.000Z',
  selectedBaseline: {
    sourceKey: 'document:document-1',
    sourceLabel: 'statement.csv',
    currency: 'NZD',
  },
  readiness: {
    status: 'limited',
    availableMetricKeys: ['cash', 'burn_rate', 'runway_months'],
    missingMetricKeys: [
      'accounts_receivable',
      'accounts_payable',
      'monthly_revenue',
      'monthly_expenses',
    ],
    historicalObservationCount: 1,
    reasons: ['Additional data is required.'],
  },
  sections: FINANCIAL_ANALYSIS_SECTION_IDS.map((sectionId) => ({
    sectionId,
    status: 'limited' as const,
    reason: 'Additional data is required.',
  })),
  facts: {
    operatingBalance: null,
    receivablesPayables: null,
    runway: {
      cash: 80000,
      monthlyBurnRate: 20000,
      cashRunwayMonths: 4,
      cashRunwayFormula: '80000 / 20000 = 4 months',
      accountsReceivable: null,
      accountsPayable: null,
      workingCapitalAdjustedRunwayMonths: null,
      workingCapitalAdjustedRunwayFormula: null,
    },
    history: [],
    forecasts: [],
  },
  narrative: {
    executiveSummary: 'The baseline has four months of cash runway.',
    financialPosition: 'Cash runway is four months.',
    trendAndForecast: 'Comparable history is unavailable.',
    risks: [],
    limitations: ['Additional data is required.'],
  },
  evidence: [],
  assumptions: ['No currency conversion was performed.'],
  agentTrace: { fallbackUsed: false, entries: [] },
  policy: {
    policyVersion: 'mvp-v1',
    decision: 'warn',
    triggeredRuleIds: ['current_runway_caution'],
    rules: [{
      ruleId: 'current_runway_caution',
      status: 'triggered',
      severity: 'warning',
      actual: 4,
      threshold: 6,
      message: 'Current cash runway is from 3 months to under 6 months.',
    }],
  },
  recommendations: [],
}
const result = normalizeFinancialAnalysisResult(legacyResult)

function queryResponse(data: unknown, error: unknown = null) {
  return {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
  }
}

describe('financial analysis persistence', () => {
  beforeEach(() => jest.clearAllMocks())

  it('inserts one immutable owner-bound report snapshot', async () => {
    const row = {
      id: 'analysis-1',
      user_id: 'owner-1',
      result_payload: result,
    }
    const query = queryResponse(row)
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as never)

    await expect(saveFinancialAnalysisRun({
      userId: 'owner-1',
      result,
      baselineFingerprint: [{ id: 'cash-1', updatedAt: '2026-06-30T00:00:00Z' }],
      modelMetadata: { agents: [] },
      tokenMetadata: { totalTokens: 0 },
    })).resolves.toEqual(row)

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'owner-1',
      selected_source_key: 'document:document-1',
      selected_currency: 'NZD',
      selection_mode: 'single',
      selected_sources: result.selectedBaseline.sources,
      reporting_period_start: '2026-09-22',
      reporting_period_end: '2026-09-22',
      run_status: 'complete',
      data_readiness: 'limited',
      result_payload: result,
      policy_version: 'mvp-v1',
    }))
    expect(query).not.toHaveProperty('update')
  })

  it('does not insert a report that fails the versioned result schema', async () => {
    mockCreateAdminClient.mockReturnValue({ from: jest.fn() } as never)

    await expect(saveFinancialAnalysisRun({
      userId: 'owner-1',
      result: { ...result, version: 'latest' } as never,
      baselineFingerprint: [],
      modelMetadata: {},
      tokenMetadata: {},
    })).rejects.toThrow()
    expect(mockCreateAdminClient).not.toHaveBeenCalled()
  })

  it('turns database failures into a safe API error', async () => {
    const query = queryResponse(null, { message: 'database detail' })
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as never)

    await expect(saveFinancialAnalysisRun({
      userId: 'owner-1',
      result,
      baselineFingerprint: [],
      modelMetadata: {},
      tokenMetadata: {},
    })).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Failed to save the financial analysis report.',
    })
  })

  it('lists only reports owned by the authenticated user', async () => {
    const row = {
      id: 'analysis-1',
      selected_source_key: 'document:document-1',
      selected_source_label: 'statement.csv',
      selected_currency: 'NZD',
      run_status: 'complete',
      data_readiness: 'limited',
      created_at: '2026-09-22T00:00:00.000Z',
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [row], error: null }),
    }
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as never)

    await expect(listFinancialAnalysisRuns('owner-1')).resolves.toEqual([{
      id: 'analysis-1',
      selectedSourceKey: 'document:document-1',
      selectedSourceLabel: 'statement.csv',
      selectedCurrency: 'NZD',
      selectionMode: 'single',
      selectedSources: [{
        sourceKey: 'document:document-1',
        sourceLabel: 'statement.csv',
      }],
      reportingPeriodStart: '2026-09-22',
      reportingPeriodEnd: '2026-09-22',
      runStatus: 'complete',
      dataReadiness: 'limited',
      createdAt: '2026-09-22T00:00:00.000Z',
    }])
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner-1')
    expect(query.limit).toHaveBeenCalledWith(20)
  })

  it('loads report details through both report and owner identifiers', async () => {
    const row = {
      id: 'analysis-1',
      selected_source_key: 'document:document-1',
      selected_source_label: 'statement.csv',
      selected_currency: 'NZD',
      run_status: 'complete',
      data_readiness: 'limited',
      result_payload: result,
      created_at: '2026-09-22T00:00:00.000Z',
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: row, error: null }),
    }
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as never)

    await expect(getFinancialAnalysisRun('analysis-1', 'owner-1')).resolves.toMatchObject({
      id: 'analysis-1',
      result,
    })
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'analysis-1')
    expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'owner-1')
  })

  it('normalizes a saved v1 result for current report display', async () => {
    const row = {
      id: 'analysis-legacy',
      selected_source_key: 'document:document-1',
      selected_source_label: 'statement.csv',
      selected_currency: 'NZD',
      selection_mode: 'single',
      selected_sources: [{
        sourceKey: 'document:document-1',
        sourceLabel: 'statement.csv',
      }],
      reporting_period_start: '2026-09-22',
      reporting_period_end: '2026-09-22',
      run_status: 'complete',
      data_readiness: 'limited',
      result_payload: legacyResult,
      created_at: '2026-09-22T00:00:00.000Z',
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: row, error: null }),
    }
    mockCreateAdminClient.mockReturnValue({ from: jest.fn().mockReturnValue(query) } as never)

    const loaded = await getFinancialAnalysisRun('analysis-legacy', 'owner-1')
    expect(loaded.result.version).toBe('financial-analysis-v2')
    expect(loaded.result.selectedBaseline.mode).toBe('single')
    expect(loaded.result.facts.periodComparisons).toHaveLength(8)
  })

  it('rejects a saved report whose versioned result payload is invalid', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'analysis-1',
          selected_source_key: 'document:document-1',
          selected_source_label: 'statement.csv',
          selected_currency: 'NZD',
          run_status: 'complete',
          data_readiness: 'limited',
          result_payload: { version: 'unknown' },
          created_at: '2026-09-22T00:00:00.000Z',
        },
        error: null,
      }),
    }
    mockCreateAdminClient.mockReturnValue({ from: jest.fn().mockReturnValue(query) } as never)

    await expect(getFinancialAnalysisRun('analysis-1', 'owner-1')).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'The saved financial analysis report is invalid.',
    })
  })

  it('permanently deletes only the owner-matched report', async () => {
    const query = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'analysis-1' }, error: null,
      }),
    }
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as never)

    await expect(
      deleteFinancialAnalysisRun('analysis-1', 'owner-1')
    ).resolves.toEqual({ deleted: true })
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 'analysis-1')
    expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'owner-1')
  })

  it('does not reveal a report that is missing or belongs to another owner', async () => {
    const query = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as never)

    await expect(
      deleteFinancialAnalysisRun('analysis-private', 'viewer-1')
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('preserves reports that have protected decision-test records', async () => {
    const query = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'foreign key violation' },
      }),
    }
    mockCreateAdminClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as never)

    await expect(
      deleteFinancialAnalysisRun('analysis-1', 'owner-1')
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
  })
})
