import { ZodError } from 'zod'
import {
  evaluateCurrentRunwayPolicy,
  evaluateFinancialDecision,
  unavailableCurrentRunwayPolicy,
} from '@/lib/financial-analysis/policies'
import type { FinancialDecisionTestInput } from '@/lib/financial-analysis/types'

function decisionInput(
  overrides: Partial<FinancialDecisionTestInput> = {}
): FinancialDecisionTestInput {
  return {
    decisionLabel: 'Hire one engineer',
    currency: 'NZD',
    baselineCash: 100000,
    baselineBurnRate: 20000,
    confirmedOneOffInflows: 0,
    oneOffOutflows: 0,
    recurringInflows: 0,
    recurringOutflows: 0,
    sixMonthLiquidity: Array.from({ length: 6 }, (_, index) => ({
      month: `2026-${String(index + 7).padStart(2, '0')}`,
      value: 80000 - index * 10000,
    })),
    overrideReason: null,
    ...overrides,
  }
}

describe('mvp-v1 financial policies', () => {
  it.each([
    [2.99, 'current_runway_urgent', 'warn'],
    [3, 'current_runway_caution', 'warn'],
    [5.99, 'current_runway_caution', 'warn'],
    [6, 'current_runway_healthy', 'allow'],
  ] as const)(
    'classifies current runway %p at exact policy boundaries',
    (runwayMonths, ruleId, decision) => {
      const result = evaluateCurrentRunwayPolicy(runwayMonths)

      expect(result.triggeredRuleIds).toEqual([ruleId])
      expect(result.decision).toBe(decision)
      expect(result.policyVersion).toBe('mvp-v1')
    }
  )

  it('marks every current-runway rule not applicable when compatible inputs are unavailable', () => {
    const result = unavailableCurrentRunwayPolicy()

    expect(result.decision).toBe('warn')
    expect(result.triggeredRuleIds).toEqual([])
    expect(result.rules.every((rule) => rule.status === 'not_applicable')).toBe(true)
  })

  it('allows the exact 4-month decision-adjusted runway boundary', () => {
    const result = evaluateFinancialDecision(decisionInput({
      baselineCash: 80000,
      baselineBurnRate: 20000,
    }))

    expect(result.policyResult.adjustedRunwayMonths).toBe(4)
    expect(result.outcome).toBe('allowed')
  })

  it('blocks immediately below the 4-month boundary', () => {
    const result = evaluateFinancialDecision(decisionInput({
      baselineCash: 79998,
      baselineBurnRate: 20000,
    }))

    expect(result.policyResult.adjustedRunwayMonths).toBe(3.9999)
    expect(result.outcome).toBe('blocked')
  })

  it('reserves one-offs against cash and applies recurring changes to burn', () => {
    const result = evaluateFinancialDecision(decisionInput({
      baselineCash: 100000,
      baselineBurnRate: 10000,
      confirmedOneOffInflows: 5000,
      oneOffOutflows: 25000,
      recurringInflows: 2000,
      recurringOutflows: 12000,
    }))

    expect(result.policyResult.adjustedCash).toBe(80000)
    expect(result.policyResult.adjustedBurnRate).toBe(20000)
    expect(result.policyResult.adjustedRunwayMonths).toBe(4)
  })

  it('never reduces adjusted burn below zero', () => {
    const result = evaluateFinancialDecision(decisionInput({
      baselineBurnRate: 10000,
      recurringInflows: 20000,
    }))

    expect(result.policyResult.adjustedBurnRate).toBe(0)
    expect(result.policyResult.adjustedRunwayMonths).toBeNull()
    expect(result.outcome).toBe('allowed')
  })

  it('preserves a negative adjusted runway value and blocks depleted cash', () => {
    const result = evaluateFinancialDecision(decisionInput({
      baselineCash: 10000,
      oneOffOutflows: 15000,
    }))

    expect(result.policyResult.adjustedCash).toBe(-5000)
    expect(result.policyResult.adjustedRunwayMonths).toBe(-0.25)
    expect(result.outcome).toBe('blocked')
  })

  it('blocks when any six-month scenario point reaches exactly zero', () => {
    const liquidity = decisionInput().sixMonthLiquidity.map((point, index) => ({
      ...point,
      value: index === 5 ? 0 : point.value,
    }))
    const result = evaluateFinancialDecision(decisionInput({
      sixMonthLiquidity: liquidity,
    }))

    expect(result.outcome).toBe('blocked')
    expect(result.policyResult.policy.triggeredRuleIds).toEqual([
      'six_month_liquidity_positive',
    ])
  })

  it('reports multiple triggered blocking policies', () => {
    const liquidity = decisionInput().sixMonthLiquidity.map((point, index) => ({
      ...point,
      value: index === 4 ? -1 : point.value,
    }))
    const result = evaluateFinancialDecision(decisionInput({
      baselineCash: 50000,
      baselineBurnRate: 20000,
      sixMonthLiquidity: liquidity,
    }))

    expect(result.policyResult.policy.triggeredRuleIds).toEqual([
      'decision_adjusted_runway_minimum',
      'six_month_liquidity_positive',
    ])
  })

  it('accepts a 10-to-500 character reason only for a blocked override', () => {
    const overridden = evaluateFinancialDecision(decisionInput({
      baselineCash: 50000,
      baselineBurnRate: 20000,
      overrideReason: 'Owner accepts the liquidity risk.',
    }))
    expect(overridden.outcome).toBe('overridden')

    expect(() => evaluateFinancialDecision(decisionInput({
      baselineCash: 50000,
      baselineBurnRate: 20000,
      overrideReason: 'Too short',
    }))).toThrow(ZodError)
    expect(() => evaluateFinancialDecision(decisionInput({
      overrideReason: 'This decision does not need an override.',
    }))).toThrow('An override can only be recorded for a blocked decision.')
  })

  it('rejects invalid inputs and malformed six-month series', () => {
    expect(() => evaluateCurrentRunwayPolicy(Number.NaN)).toThrow(ZodError)
    expect(() => evaluateFinancialDecision(decisionInput({
      baselineCash: -1,
    }))).toThrow(ZodError)
    expect(() => evaluateFinancialDecision(decisionInput({
      sixMonthLiquidity: decisionInput().sixMonthLiquidity.slice(0, 5),
    }))).toThrow(ZodError)
  })
})
