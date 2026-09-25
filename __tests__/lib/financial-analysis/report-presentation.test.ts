import {
  buildFinancialAnalysisReportHeading,
  getCurrentRunwayResult,
  getPolicyRuleStatusLabel,
} from '@/lib/financial-analysis/report-presentation'
import type {
  FinancialAnalysisEvidence,
  FinancialPolicyEvaluation,
} from '@/lib/financial-analysis/types'

function evidence(overrides: Partial<FinancialAnalysisEvidence> = {}): FinancialAnalysisEvidence {
  return {
    observationId: 'observation-1',
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
    ...overrides,
  }
}

function policy(
  triggeredRuleIds: FinancialPolicyEvaluation['triggeredRuleIds']
): FinancialPolicyEvaluation {
  return {
    policyVersion: 'mvp-v1',
    decision: triggeredRuleIds.includes('current_runway_healthy') ? 'allow' : 'warn',
    triggeredRuleIds,
    rules: [],
  }
}

describe('financial analysis report presentation', () => {
  it('derives a single reporting date and distinct source count from evidence', () => {
    const heading = buildFinancialAnalysisReportHeading({
      evidence: [
        evidence(),
        evidence({ observationId: 'burn-1', metricKey: 'burn_rate' }),
        evidence({
          observationId: 'cash-2',
          sourceLabel: 'cashbook.xlsx',
          sourceKey: 'document:document-2',
        }),
      ],
      fallbackSourceLabel: 'fallback.csv',
    })

    expect(heading).toEqual({
      firstReportingDate: '2026-06-30',
      lastReportingDate: '2026-06-30',
      reportingDateCount: 1,
      sourceCount: 2,
    })
  })

  it('derives the inclusive reporting range for a multi-period report', () => {
    const heading = buildFinancialAnalysisReportHeading({
      evidence: [
        evidence({ reportingDate: '2026-06-30' }),
        evidence({ observationId: 'cash-0', reportingDate: '2026-01-31' }),
        evidence({ observationId: 'cash-1', reportingDate: '2026-03-31' }),
      ],
      fallbackSourceLabel: 'statement.csv',
    })

    expect(heading).toMatchObject({
      firstReportingDate: '2026-01-31',
      lastReportingDate: '2026-06-30',
      reportingDateCount: 3,
      sourceCount: 1,
    })
  })

  it('uses the selected source as provenance when no evidence rows are available', () => {
    expect(buildFinancialAnalysisReportHeading({
      evidence: [],
      fallbackSourceLabel: 'statement.csv',
    })).toEqual({
      firstReportingDate: null,
      lastReportingDate: null,
      reportingDateCount: 0,
      sourceCount: 1,
    })
  })

  it.each([
    [['current_runway_urgent'], 'urgent'],
    [['current_runway_caution'], 'caution'],
    [['current_runway_healthy'], 'healthy'],
    [[], 'not_evaluated'],
  ] as const)('maps policy rule %p to the prominent result %s', (ruleIds, expected) => {
    expect(getCurrentRunwayResult(policy([...ruleIds]))).toBe(expected)
  })

  it.each([
    ['triggered', 'Matched'],
    ['passed', 'Not matched'],
    ['not_applicable', 'Not evaluated'],
  ] as const)('labels detailed rule status %s as %s', (status, expected) => {
    expect(getPolicyRuleStatusLabel(status)).toBe(expected)
  })
})
