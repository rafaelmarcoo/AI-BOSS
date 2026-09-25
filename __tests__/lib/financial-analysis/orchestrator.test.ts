import {
  runFinancialAnalysis,
  type FinancialAnalysisOrchestratorDependencies,
} from '@/lib/financial-analysis/orchestrator'
import {
  FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS,
  FINANCIAL_ANALYSIS_SECTION_IDS,
} from '@/lib/financial-analysis/types'
import type { FinancialAnalysisCollection } from '@/lib/financial-analysis/collector'
import type { FinancialAnalysisRun } from '@/types/database'

const collection: FinancialAnalysisCollection = {
  selection: {
    mode: 'single',
    sourceKey: 'document:document-1',
    sourceLabel: 'statement.csv',
    sourceKeys: ['document:document-1'],
    sources: [{
      sourceKey: 'document:document-1',
      sourceLabel: 'statement.csv',
      sourceType: 'document',
      documentId: 'document-1',
      connectionId: null,
    }],
    currency: 'NZD',
    reportingPeriodStart: '2026-04-30',
    reportingPeriodEnd: '2026-06-30',
    reportDate: '2026-06-30',
  },
  readiness: {
    status: 'ready',
    availableMetricKeys: [
      'cash',
      'accounts_receivable',
      'accounts_payable',
      'monthly_revenue',
      'monthly_expenses',
      'burn_rate',
      'runway_months',
    ],
    missingMetricKeys: [],
    historicalObservationCount: 3,
    reasons: [],
  },
  sections: FINANCIAL_ANALYSIS_SECTION_IDS.map((sectionId) => ({
    sectionId,
    status: 'available' as const,
    reason: null,
  })),
  facts: {
    operatingBalance: {
      monthlyRevenue: 60000,
      monthlyExpenses: 70000,
      operatingBalance: -10000,
      position: 'negative',
      formula: '60000 - 70000 = -10000',
    },
    receivablesPayables: {
      accountsReceivable: 16000,
      accountsPayable: 14000,
      netPosition: 2000,
      position: 'net_receivable',
      formula: '16000 - 14000 = 2000',
    },
    runway: {
      cash: 85000,
      monthlyBurnRate: 17000,
      cashRunwayMonths: 5,
      cashRunwayFormula: '85000 / 17000 = 5 months',
      accountsReceivable: 16000,
      accountsPayable: 14000,
      workingCapitalAdjustedRunwayMonths: 5.12,
      workingCapitalAdjustedRunwayFormula:
        '(85000 + 16000 - 14000) / 17000 = 5.12 months',
    },
    history: [{
      metricKey: 'cash',
      direction: 'worsening',
      observationCount: 3,
      firstValue: 103000,
      latestValue: 85000,
      absoluteChange: -18000,
      percentageChange: -17.48,
      values: [
        { date: '2026-04-30', value: 103000 },
        { date: '2026-05-31', value: 94000 },
        { date: '2026-06-30', value: 85000 },
      ],
    }],
    forecasts: [{
      metricKey: 'cash',
      method: 'date_aware_linear_trend',
      monthlySlope: -9000,
      values: Array.from({ length: 6 }, (_, index) => ({
        month: `2026-${String(index + 7).padStart(2, '0')}`,
        value: 76000 - index * 9000,
      })),
    }],
    periodComparisons: FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS.map((metricKey) => ({
      metricKey,
      earliest: null,
      previous: null,
      latest: null,
      startToLatestChange: null,
      previousToLatestChange: null,
      unavailableReason: 'Comparison unavailable.',
    })),
  },
  evidence: [{
    observationId: 'cash-current',
    metricKey: 'cash',
    value: 85000,
    currency: 'NZD',
    reportingDate: '2026-06-30',
    sourceLabel: 'statement.csv',
    sourceType: 'document',
    sourceKey: 'document:document-1',
    documentId: 'document-1',
    connectionId: null,
    confidence: 0.95,
    usedInCalculations: true,
    resolution: 'uncontested',
  }],
  assumptions: ['No currency conversion was performed.'],
  baselineFingerprint: [{
    id: 'cash-current',
    updatedAt: '2026-06-30T00:00:00.000Z',
  }],
}

const positionOutput = {
  summary: 'Position summary.',
  risks: ['Position risk.'],
  limitations: [],
}
const trendOutput = {
  summary: 'Trend summary.',
  risks: ['Trend risk.'],
  limitations: ['Forecast is not guaranteed.'],
}
const narrative = {
  executiveSummary: 'Executive summary.',
  financialPosition: 'Position summary.',
  trendAndForecast: 'Trend summary.',
  risks: ['Position risk.', 'Trend risk.'],
  limitations: ['Forecast is not guaranteed.'],
}

function savedRun(
  result: Parameters<FinancialAnalysisOrchestratorDependencies['save']>[0]
): FinancialAnalysisRun {
  return {
    id: 'analysis-1',
    user_id: result.userId,
    selected_source_key: result.result.selectedBaseline.sourceKey,
    selected_source_label: result.result.selectedBaseline.sourceLabel,
    selected_currency: result.result.selectedBaseline.currency,
    selection_mode: result.result.selectedBaseline.mode,
    selected_sources: result.result.selectedBaseline.sources,
    reporting_period_start: result.result.selectedBaseline.reportingPeriodStart,
    reporting_period_end: result.result.selectedBaseline.reportingPeriodEnd,
    run_status: result.result.runStatus,
    data_readiness: result.result.readiness.status,
    baseline_fingerprint: result.baselineFingerprint,
    result_payload: result.result,
    agent_trace: result.result.agentTrace,
    policy_version: 'mvp-v1',
    model_metadata: result.modelMetadata,
    token_metadata: result.tokenMetadata,
    created_at: '2026-09-22T00:00:00.000Z',
  }
}

describe('financial analysis orchestrator', () => {
  it('runs specialist agents in parallel, applies deterministic policy, and saves one immutable result', async () => {
    let resolvePosition!: (value: {
      output: typeof positionOutput
      model: string
      tokensUsed: number
    }) => void
    let resolveTrend!: (value: {
      output: typeof trendOutput
      model: string
      tokensUsed: number
    }) => void
    const positionPromise = new Promise<{
      output: typeof positionOutput
      model: string
      tokensUsed: number
    }>((resolve) => { resolvePosition = resolve })
    const trendPromise = new Promise<{
      output: typeof trendOutput
      model: string
      tokensUsed: number
    }>((resolve) => { resolveTrend = resolve })
    const runFinancialPosition = jest.fn(() => positionPromise)
    const runTrendForecast = jest.fn(() => trendPromise)
    const save = jest.fn(async (params) => savedRun(params))

    const pending = runFinancialAnalysis({
      userId: 'owner-1',
      request: { sourceKey: 'document:document-1', currency: 'NZD' },
    }, {
      collect: jest.fn().mockResolvedValue(collection),
      runFinancialPosition,
      runTrendForecast,
      runExecutiveSynthesis: jest.fn().mockResolvedValue({
        output: narrative,
        model: 'test-model',
        tokensUsed: 30,
      }),
      save,
      now: () => '2026-09-22T00:00:00.000Z',
    })

    await Promise.resolve()
    expect(runFinancialPosition).toHaveBeenCalledTimes(1)
    expect(runTrendForecast).toHaveBeenCalledTimes(1)

    resolvePosition({ output: positionOutput, model: 'test-model', tokensUsed: 10 })
    resolveTrend({ output: trendOutput, model: 'test-model', tokensUsed: 20 })
    const run = await pending

    expect(run.run_status).toBe('complete')
    expect(run.result_payload.policy.triggeredRuleIds).toEqual([
      'current_runway_caution',
    ])
    expect(run.result_payload.recommendations.map((item) => item.id)).toEqual([
      'restore_operating_balance',
      'address_worsening_cash_or_burn',
      'improve_collections_and_payable_timing',
    ])
    expect(run.agent_trace.entries.map((entry) => entry.step)).toEqual([
      'collector',
      'financial_position_agent',
      'trend_forecast_agent',
      'policy_engine',
      'executive_synthesizer',
    ])
    expect(run.token_metadata).toMatchObject({ totalTokens: 60, complete: true })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('persists a deterministic report when all model steps fail', async () => {
    const save = jest.fn(async (params) => savedRun(params))
    const run = await runFinancialAnalysis({
      userId: 'owner-1',
      request: { sourceKey: 'document:document-1', currency: 'NZD' },
    }, {
      collect: jest.fn().mockResolvedValue(collection),
      runFinancialPosition: jest.fn().mockRejectedValue(new Error('model unavailable')),
      runTrendForecast: jest.fn().mockRejectedValue(new Error('model unavailable')),
      runExecutiveSynthesis: jest.fn().mockRejectedValue(new Error('model unavailable')),
      save,
      now: () => '2026-09-22T00:00:00.000Z',
    })

    expect(run.run_status).toBe('completed_with_fallback')
    expect(run.agent_trace.fallbackUsed).toBe(true)
    expect(run.agent_trace.entries.filter(
      (entry) => entry.status === 'completed_with_fallback'
    )).toHaveLength(3)
    expect(run.result_payload.narrative.executiveSummary).toContain(
      'Cash is NZD 85,000'
    )
    expect(run.model_metadata).toEqual({
      agents: [
        { step: 'financial_position_agent', model: null, fallbackUsed: true },
        { step: 'trend_forecast_agent', model: null, fallbackUsed: true },
        { step: 'executive_synthesizer', model: null, fallbackUsed: true },
      ],
    })
    expect(run.token_metadata).toMatchObject({ totalTokens: null, complete: false })
  })

  it('does not persist when deterministic collection fails', async () => {
    const save = jest.fn()

    await expect(runFinancialAnalysis({
      userId: 'owner-1',
      request: { sourceKey: 'document:document-1', currency: 'NZD' },
    }, {
      collect: jest.fn().mockRejectedValue(new Error('invalid baseline')),
      save,
    })).rejects.toThrow('invalid baseline')
    expect(save).not.toHaveBeenCalled()
  })
})
