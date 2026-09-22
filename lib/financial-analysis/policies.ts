import { z } from 'zod'
import {
  FINANCIAL_ANALYSIS_POLICY_VERSION,
  FinancialDecisionTestInputSchema,
  FinancialDecisionTestResultSchema,
  type FinancialDecisionTestInput,
  type FinancialDecisionTestResult,
  type FinancialPolicyEvaluation,
  type FinancialPolicyRuleEvaluation,
} from '@/lib/financial-analysis/types'

const CurrentRunwayInputSchema = z.number().finite().nonnegative()
const URGENT_RUNWAY_MONTHS = 3
const HEALTHY_RUNWAY_MONTHS = 6
const DECISION_MINIMUM_RUNWAY_MONTHS = 4

function currentRunwayRule(params: {
  ruleId: FinancialPolicyRuleEvaluation['ruleId']
  status: FinancialPolicyRuleEvaluation['status']
  severity: FinancialPolicyRuleEvaluation['severity']
  runwayMonths: number
  threshold: number
  message: string
}): FinancialPolicyRuleEvaluation {
  return {
    ruleId: params.ruleId,
    status: params.status,
    severity: params.severity,
    actual: params.runwayMonths,
    threshold: params.threshold,
    message: params.message,
  }
}

export function evaluateCurrentRunwayPolicy(
  runwayMonths: number
): FinancialPolicyEvaluation {
  const parsed = CurrentRunwayInputSchema.parse(runwayMonths)
  const urgent = parsed < URGENT_RUNWAY_MONTHS
  const caution = parsed >= URGENT_RUNWAY_MONTHS && parsed < HEALTHY_RUNWAY_MONTHS
  const healthy = parsed >= HEALTHY_RUNWAY_MONTHS
  const rules: FinancialPolicyRuleEvaluation[] = [
    currentRunwayRule({
      ruleId: 'current_runway_urgent',
      status: urgent ? 'triggered' : 'passed',
      severity: 'warning',
      runwayMonths: parsed,
      threshold: URGENT_RUNWAY_MONTHS,
      message: urgent
        ? 'Current cash runway is under 3 months and needs urgent attention.'
        : 'Current cash runway is not in the urgent band.',
    }),
    currentRunwayRule({
      ruleId: 'current_runway_caution',
      status: caution ? 'triggered' : 'passed',
      severity: 'warning',
      runwayMonths: parsed,
      threshold: HEALTHY_RUNWAY_MONTHS,
      message: caution
        ? 'Current cash runway is from 3 months to under 6 months.'
        : 'Current cash runway is not in the caution band.',
    }),
    currentRunwayRule({
      ruleId: 'current_runway_healthy',
      status: healthy ? 'triggered' : 'passed',
      severity: 'info',
      runwayMonths: parsed,
      threshold: HEALTHY_RUNWAY_MONTHS,
      message: healthy
        ? 'Current cash runway is at least 6 months.'
        : 'Current cash runway is below the healthy band.',
    }),
  ]
  const triggeredRuleIds = rules
    .filter((rule) => rule.status === 'triggered')
    .map((rule) => rule.ruleId)

  return {
    policyVersion: FINANCIAL_ANALYSIS_POLICY_VERSION,
    decision: healthy ? 'allow' : 'warn',
    triggeredRuleIds,
    rules,
  }
}

export function unavailableCurrentRunwayPolicy(): FinancialPolicyEvaluation {
  return {
    policyVersion: FINANCIAL_ANALYSIS_POLICY_VERSION,
    decision: 'warn',
    triggeredRuleIds: [],
    rules: [
      {
        ruleId: 'current_runway_urgent',
        status: 'not_applicable',
        severity: 'warning',
        actual: null,
        threshold: URGENT_RUNWAY_MONTHS,
        message: 'Urgent runway policy could not be evaluated from compatible current inputs.',
      },
      {
        ruleId: 'current_runway_caution',
        status: 'not_applicable',
        severity: 'warning',
        actual: null,
        threshold: HEALTHY_RUNWAY_MONTHS,
        message: 'Caution runway policy could not be evaluated from compatible current inputs.',
      },
      {
        ruleId: 'current_runway_healthy',
        status: 'not_applicable',
        severity: 'info',
        actual: null,
        threshold: HEALTHY_RUNWAY_MONTHS,
        message: 'Healthy runway policy could not be evaluated from compatible current inputs.',
      },
    ],
  }
}

function round(value: number, fractionDigits = 2) {
  return Number(value.toFixed(fractionDigits))
}

export function evaluateFinancialDecision(
  input: FinancialDecisionTestInput
): FinancialDecisionTestResult {
  const parsed = FinancialDecisionTestInputSchema.parse(input)
  const adjustedCash = round(
    parsed.baselineCash +
    parsed.confirmedOneOffInflows -
    parsed.oneOffOutflows
  )
  const adjustedBurnRate = round(Math.max(
    0,
    parsed.baselineBurnRate +
      parsed.recurringOutflows -
      parsed.recurringInflows
  ))
  const rawAdjustedRunwayMonths = adjustedBurnRate === 0
    ? null
    : adjustedCash / adjustedBurnRate
  const adjustedRunwayMonths = rawAdjustedRunwayMonths === null
    ? null
    : round(rawAdjustedRunwayMonths, 4)
  const minimumSixMonthLiquidity = Math.min(
    ...parsed.sixMonthLiquidity.map((point) => point.value)
  )
  const runwayBlocked =
    adjustedCash <= 0 ||
    (rawAdjustedRunwayMonths !== null &&
      rawAdjustedRunwayMonths < DECISION_MINIMUM_RUNWAY_MONTHS)
  const liquidityBlocked = minimumSixMonthLiquidity <= 0
  const rules: FinancialPolicyRuleEvaluation[] = [
    {
      ruleId: 'decision_adjusted_runway_minimum',
      status: runwayBlocked ? 'triggered' : 'passed',
      severity: 'block',
      actual: adjustedRunwayMonths,
      threshold: DECISION_MINIMUM_RUNWAY_MONTHS,
      message: adjustedCash <= 0
        ? 'Cash after confirmed one-off inflows and reserved one-off outflows is zero or negative.'
        : runwayBlocked
        ? 'Decision-adjusted runway is below the 4-month minimum.'
        : adjustedRunwayMonths === null
          ? 'Adjusted recurring burn is zero, so the runway threshold does not block this decision.'
          : 'Decision-adjusted runway meets the 4-month minimum.',
    },
    {
      ruleId: 'six_month_liquidity_positive',
      status: liquidityBlocked ? 'triggered' : 'passed',
      severity: 'block',
      actual: minimumSixMonthLiquidity,
      threshold: 0,
      message: liquidityBlocked
        ? 'The six-month scenario reaches zero or negative liquidity.'
        : 'The six-month scenario remains above zero liquidity.',
    },
  ]
  const blocked = rules.some((rule) => rule.status === 'triggered')

  if (!blocked && parsed.overrideReason !== null) {
    throw new Error('An override can only be recorded for a blocked decision.')
  }

  const outcome = blocked
    ? parsed.overrideReason === null ? 'blocked' : 'overridden'
    : 'allowed'
  const result: FinancialDecisionTestResult = {
    policyResult: {
      adjustedCash,
      adjustedBurnRate,
      adjustedRunwayMonths,
      minimumSixMonthLiquidity,
      policy: {
        policyVersion: FINANCIAL_ANALYSIS_POLICY_VERSION,
        decision: blocked ? 'block' : 'allow',
        triggeredRuleIds: rules
          .filter((rule) => rule.status === 'triggered')
          .map((rule) => rule.ruleId),
        rules,
      },
    },
    outcome,
    overrideReason: outcome === 'overridden' ? parsed.overrideReason : null,
  }

  return FinancialDecisionTestResultSchema.parse(result)
}
