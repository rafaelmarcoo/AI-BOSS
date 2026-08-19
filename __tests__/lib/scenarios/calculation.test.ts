import { calculateScenarioAnalysis, monthAfterDate } from '@/lib/scenarios/calculation'
import type { ScenarioBaselineInputs } from '@/lib/scenarios/calculation'
import type { ScenarioAnalysisInput } from '@/lib/scenarios/schema'

function metric(value: number, reportingDate = '2026-05-31') {
  return {
    value,
    sourceLabel: 'statement.csv',
    reportingDate,
    confidence: 0.95,
    origin: 'verified' as const,
    observationId: `metric-${value}`,
  }
}

const baselineInputs: ScenarioBaselineInputs = {
  sourceKey: 'document:statement-1',
  sourceLabel: 'statement.csv',
  currency: 'NZD',
  cash: metric(100000),
  accountsReceivable: metric(20000),
  accountsPayable: metric(10000),
  burnRate: metric(10000),
  monthlyRevenue: metric(50000),
  monthlyExpenses: metric(40000),
  historicalMonthlyCashSlope: -8000,
  historicalObservationCount: 3,
  historicalSourceLabels: ['statement.csv'],
  historicalHasRecordedDateFallback: false,
  observationFingerprint: [{ id: 'cash-1', updatedAt: '2026-05-31T00:00:00Z' }],
}

const input: ScenarioAnalysisInput = {
  sourceKey: 'document:statement-1',
  currency: 'NZD',
  horizon: 3,
  trendRange: '6m',
  manualBaseline: {},
  scenarios: [
    {
      id: 'hire',
      label: 'Hire',
      adjustments: [
        {
          id: 'salary',
          label: 'Employer cost',
          kind: 'fixed',
          flow: 'outflow',
          frequency: 'recurring',
          amount: 5000,
          startMonth: '2026-06',
          endMonth: '2026-07',
        },
      ],
    },
  ],
}

describe('scenario calculation', () => {
  it('uses safe calendar month arithmetic at month end', () => {
    expect(monthAfterDate('2026-05-31')).toBe('2026-06')
    expect(monthAfterDate('2024-01-31')).toBe('2024-02')
    expect(monthAfterDate('2024-12-31')).toBe('2025-01')
    expect(monthAfterDate('2024-02-29')).toBe('2024-03')
  })

  it('calculates current and historical panels from one scenario', () => {
    const result = calculateScenarioAnalysis({ input, baselineInputs, now: '2026-06-01T00:00:00Z' })

    expect(result.openingLiquidity).toBe(110000)
    expect(result.openingBridge.formula).toBe('100000 + 20000 - 10000 = 110000')
    expect(result.panels[0].series[0].points.map((point) => point.value)).toEqual([100000, 90000, 80000])
    expect(result.panels[0].series[1].points.map((point) => point.value)).toEqual([95000, 80000, 70000])
    expect(result.panels[1].series[0].points.map((point) => point.value)).toEqual([102000, 94000, 86000])
  })

  it('resolves fixed and compounding percentages with correct cash direction', () => {
    const percentageInput: ScenarioAnalysisInput = {
      ...input,
      scenarios: [{
        id: 'growth',
        label: 'Growth',
        adjustments: [
          {
            id: 'revenue', label: 'Revenue growth', kind: 'percentage', mode: 'compound',
            metric: 'monthly_revenue', percentageChange: 10, startMonth: '2026-06', endMonth: '2026-07',
          },
          {
            id: 'expenses', label: 'Expense cut', kind: 'percentage', mode: 'step',
            metric: 'monthly_expenses', percentageChange: -10, startMonth: '2026-06', endMonth: '2026-08',
          },
        ],
      }],
    }

    const result = calculateScenarioAnalysis({ input: percentageInput, baselineInputs })
    const effects = result.panels[0].series[1].resolvedAdjustments
    expect(effects[0].monthlyEffects.map((effect) => effect.value)).toEqual([5000, 10500, 10500])
    expect(effects[1].monthlyEffects.map((effect) => effect.value)).toEqual([4000, 4000, 4000])
  })

  it('combines one-off inflows and recurring outflows in inclusive monthly buckets', () => {
    const combinedInput: ScenarioAnalysisInput = {
      ...input,
      scenarios: [{
        id: 'combined', label: 'Combined', adjustments: [
          { id: 'funding', label: 'Funding', kind: 'fixed', flow: 'inflow', frequency: 'one_off', amount: 30000, startMonth: '2026-07' },
          { id: 'hire', label: 'Hire', kind: 'fixed', flow: 'outflow', frequency: 'recurring', amount: 5000, startMonth: '2026-06', endMonth: '2026-07' },
        ],
      }],
    }
    const result = calculateScenarioAnalysis({ input: combinedInput, baselineInputs })
    expect(result.panels[0].series[1].points.map((point) => point.netMovement)).toEqual([-15000, 15000, -10000])
    expect(result.panels[0].series[1].summary.cashOutMonth).toBeNull()
  })

  it('applies expense and burn percentage direction consistently', () => {
    const directionInput: ScenarioAnalysisInput = {
      ...input,
      scenarios: [{
        id: 'directions', label: 'Directions', adjustments: [
          { id: 'burn-up', label: 'Burn increase', kind: 'percentage', mode: 'step', metric: 'burn_rate', percentageChange: 10, startMonth: '2026-06' },
          { id: 'expense-down', label: 'Expense reduction', kind: 'percentage', mode: 'step', metric: 'monthly_expenses', percentageChange: -10, startMonth: '2026-06' },
        ],
      }],
    }
    const effects = calculateScenarioAnalysis({ input: directionInput, baselineInputs }).panels[0].series[1].resolvedAdjustments
    expect(effects[0].monthlyEffects[0].value).toBe(-1000)
    expect(effects[1].monthlyEffects[0].value).toBe(4000)
  })

  it('continues below zero and reports the first cash-out month', () => {
    const result = calculateScenarioAnalysis({
      input: { ...input, horizon: 12, scenarios: input.scenarios.map((scenario) => ({
        ...scenario,
        adjustments: scenario.adjustments.map((adjustment) => ({ ...adjustment, endMonth: '2027-05' })),
      })) },
      baselineInputs,
    })
    const scenario = result.panels[0].series[1]
    expect(scenario.summary.cashOutMonth).toBe('2027-01')
    expect(scenario.points.at(-1)!.value).toBeLessThan(0)
    expect(result.warnings.join(' ')).toContain('12-month')
  })

  it('shows one panel as unavailable without blocking the other', () => {
    const result = calculateScenarioAnalysis({
      input,
      baselineInputs: { ...baselineInputs, burnRate: null },
    })
    expect(result.panels[0].available).toBe(false)
    expect(result.panels[1].available).toBe(true)
  })

  it('rejects adjustments outside the selected horizon', () => {
    expect(() => calculateScenarioAnalysis({
      input: {
        ...input,
        scenarios: [{
          ...input.scenarios[0],
          adjustments: [{ ...input.scenarios[0].adjustments[0], startMonth: '2027-01' }],
        }],
      },
      baselineInputs,
    })).toThrow('outside the selected horizon')
  })
})
