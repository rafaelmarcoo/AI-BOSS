import {
  FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS,
  FINANCIAL_ANALYSIS_LEGACY_SECTION_IDS,
  FinancialAnalysisResultSchema,
  FinancialDecisionTestResultSchema,
  PersistedFinancialAnalysisResultSchema,
  normalizeFinancialAnalysisResult,
} from '@/lib/financial-analysis/types'

const policy = {
  policyVersion: 'mvp-v1' as const,
  decision: 'allow' as const,
  triggeredRuleIds: ['current_runway_healthy' as const],
  rules: [{
    ruleId: 'current_runway_healthy' as const,
    status: 'triggered' as const,
    severity: 'info' as const,
    actual: 6,
    threshold: 6,
    message: 'Current cash runway is at least 6 months.',
  }],
}

describe('financial analysis domain schemas', () => {
  it('accepts and normalizes the legacy immutable report shape', () => {
    const legacyResult = PersistedFinancialAnalysisResultSchema.parse({
      version: 'financial-analysis-v1',
      runStatus: 'complete',
      generatedAt: '2026-09-22T00:00:00.000Z',
      selectedBaseline: {
        sourceKey: 'document:statement-1',
        sourceLabel: 'statement.csv',
        currency: 'NZD',
      },
      readiness: {
        status: 'ready',
        availableMetricKeys: ['cash', 'burn_rate'],
        missingMetricKeys: [],
        historicalObservationCount: 2,
        reasons: [],
      },
      sections: FINANCIAL_ANALYSIS_LEGACY_SECTION_IDS.map((sectionId) => ({
        sectionId,
        status: 'available',
        reason: null,
      })),
      facts: {
        operatingBalance: null,
        receivablesPayables: null,
        runway: null,
        history: [],
        forecasts: [],
      },
      narrative: {
        executiveSummary: 'The selected baseline has a healthy cash runway.',
        financialPosition: 'Current financial position is supported by reviewed observations.',
        trendAndForecast: 'The six-month trend forecast is a continuation estimate.',
        risks: [],
        limitations: [],
      },
      evidence: [],
      assumptions: ['No currency conversion was performed.'],
      agentTrace: { fallbackUsed: false, entries: [] },
      policy,
      recommendations: [],
    })

    const result = normalizeFinancialAnalysisResult(legacyResult)
    expect(result.version).toBe('financial-analysis-v3')
    expect(result.selectedBaseline.mode).toBe('single')
    expect(result.facts.periodComparisons).toHaveLength(8)
    expect(result.facts.ratios.limitations[0]).toContain('legacy report')

    const v2Result = PersistedFinancialAnalysisResultSchema.parse({
      ...result,
      version: 'financial-analysis-v2',
      sections: result.sections.filter(
        (section) => section.sectionId !== 'financial_ratios'
      ),
      facts: {
        operatingBalance: result.facts.operatingBalance,
        receivablesPayables: result.facts.receivablesPayables,
        runway: null,
        history: result.facts.history,
        forecasts: result.facts.forecasts,
        periodComparisons: result.facts.periodComparisons,
      },
    })
    expect(normalizeFinancialAnalysisResult(v2Result).version)
      .toBe('financial-analysis-v3')
  })

  it('accepts the current report shape and requires every comparison metric', () => {
    const result = FinancialAnalysisResultSchema.safeParse({
      ...normalizeFinancialAnalysisResult(PersistedFinancialAnalysisResultSchema.parse({
        version: 'financial-analysis-v1',
        runStatus: 'complete',
        generatedAt: '2026-09-22T00:00:00.000Z',
        selectedBaseline: {
          sourceKey: 'document:statement-1',
          sourceLabel: 'statement.csv',
          currency: 'NZD',
        },
        readiness: {
          status: 'ready',
          availableMetricKeys: ['cash'],
          missingMetricKeys: [],
          historicalObservationCount: 1,
          reasons: [],
        },
        sections: FINANCIAL_ANALYSIS_LEGACY_SECTION_IDS.map((sectionId) => ({
          sectionId,
          status: 'available',
          reason: null,
        })),
        facts: {
          operatingBalance: null,
          receivablesPayables: null,
          runway: null,
          history: [],
          forecasts: [],
        },
        narrative: {
          executiveSummary: 'Summary.',
          financialPosition: 'Position.',
          trendAndForecast: 'Trend.',
          risks: [],
          limitations: [],
        },
        evidence: [],
        assumptions: ['No conversion.'],
        agentTrace: { fallbackUsed: false, entries: [] },
        policy,
        recommendations: [],
      })),
      facts: {
        operatingBalance: null,
        receivablesPayables: null,
        runway: null,
        history: [],
        forecasts: [],
        periodComparisons: FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS.map(
          (metricKey) => ({
            metricKey,
            earliest: null,
            previous: null,
            latest: null,
            startToLatestChange: null,
            previousToLatestChange: null,
            unavailableReason: 'Unavailable.',
          })
        ),
        ratios: {
          calculated: [],
          unavailable: [],
          limitations: ['Legacy report.'],
        },
      },
    })

    expect(result.success).toBe(true)
  })

  it('rejects an unversioned report and inconsistent override result', () => {
    expect(FinancialAnalysisResultSchema.safeParse({ version: 'latest' }).success).toBe(false)
    expect(FinancialDecisionTestResultSchema.safeParse({
      policyResult: {
        adjustedCash: 50000,
        adjustedBurnRate: 20000,
        adjustedRunwayMonths: 2.5,
        minimumSixMonthLiquidity: 1000,
        policy: { ...policy, decision: 'block' },
      },
      outcome: 'overridden',
      overrideReason: null,
    }).success).toBe(false)
  })
})
