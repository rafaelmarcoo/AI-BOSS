import type {
  FinancialAnalysisEvidence,
  FinancialPolicyEvaluation,
  FinancialPolicyRuleEvaluation,
} from '@/lib/financial-analysis/types'

export type CurrentRunwayResult =
  | 'urgent'
  | 'caution'
  | 'healthy'
  | 'not_evaluated'

export interface FinancialAnalysisReportHeading {
  firstReportingDate: string | null
  lastReportingDate: string | null
  reportingDateCount: number
  sourceCount: number
}

export function buildFinancialAnalysisReportHeading(params: {
  evidence: FinancialAnalysisEvidence[]
  fallbackSourceLabel: string
}): FinancialAnalysisReportHeading {
  const reportingDates = [...new Set(
    params.evidence.map((item) => item.reportingDate)
  )].sort()
  const sourceKeys = new Set(
    params.evidence.map((item) => item.sourceKey.trim()).filter(Boolean)
  )

  if (sourceKeys.size === 0) {
    sourceKeys.add(params.fallbackSourceLabel)
  }

  return {
    firstReportingDate: reportingDates[0] ?? null,
    lastReportingDate: reportingDates.at(-1) ?? null,
    reportingDateCount: reportingDates.length,
    sourceCount: sourceKeys.size,
  }
}

export function getCurrentRunwayResult(
  policy: FinancialPolicyEvaluation
): CurrentRunwayResult {
  if (policy.triggeredRuleIds.includes('current_runway_urgent')) return 'urgent'
  if (policy.triggeredRuleIds.includes('current_runway_caution')) return 'caution'
  if (policy.triggeredRuleIds.includes('current_runway_healthy')) return 'healthy'
  return 'not_evaluated'
}

export function getPolicyRuleStatusLabel(
  status: FinancialPolicyRuleEvaluation['status']
) {
  if (status === 'triggered') return 'Matched'
  if (status === 'passed') return 'Not matched'
  return 'Not evaluated'
}
