import { ScenarioAnalysisInputSchema } from '@/lib/scenarios/schema'

function percentage(percentageChange: number) {
  return {
    id: 'adjustment-1',
    label: 'Revenue change',
    kind: 'percentage' as const,
    mode: 'step' as const,
    metric: 'monthly_revenue' as const,
    percentageChange,
    startMonth: '2026-06',
  }
}

function input(adjustments: unknown[] = [percentage(10)]) {
  return {
    sourceKey: 'document:doc-1',
    currency: 'NZD',
    manualBaseline: {},
    scenarios: [{ id: 'scenario-1', label: 'Growth', adjustments }],
  }
}

describe('ScenarioAnalysisInputSchema', () => {
  it('applies the six-month defaults', () => {
    const parsed = ScenarioAnalysisInputSchema.parse(input())
    expect(parsed.horizon).toBe(6)
    expect(parsed.trendRange).toBe('6m')
  })

  it('accepts the inclusive percentage limits and rejects values outside them', () => {
    expect(ScenarioAnalysisInputSchema.safeParse(input([percentage(-100)])).success).toBe(true)
    expect(ScenarioAnalysisInputSchema.safeParse(input([percentage(1000)])).success).toBe(true)
    expect(ScenarioAnalysisInputSchema.safeParse(input([percentage(-100.01)])).success).toBe(false)
    expect(ScenarioAnalysisInputSchema.safeParse(input([percentage(1000.01)])).success).toBe(false)
  })

  it('enforces one to three scenarios and one to ten adjustments', () => {
    const base = input()
    expect(ScenarioAnalysisInputSchema.safeParse({ ...base, scenarios: [] }).success).toBe(false)
    expect(ScenarioAnalysisInputSchema.safeParse({
      ...base,
      scenarios: Array.from({ length: 3 }, (_, index) => ({
        id: `scenario-${index}`,
        label: `Scenario ${index}`,
        adjustments: Array.from({ length: 10 }, (__, adjustmentIndex) => ({
          ...percentage(10),
          id: `adjustment-${adjustmentIndex}`,
        })),
      })),
    }).success).toBe(true)
    expect(ScenarioAnalysisInputSchema.safeParse({
      ...base,
      scenarios: Array.from({ length: 4 }, (_, index) => ({
        id: `scenario-${index}`,
        label: `Scenario ${index}`,
        adjustments: [percentage(10)],
      })),
    }).success).toBe(false)
  })

  it('rejects an end month on a one-off adjustment and unsupported currencies', () => {
    const oneOff = {
      id: 'equipment', label: 'Equipment', kind: 'fixed' as const,
      flow: 'outflow' as const, frequency: 'one_off' as const,
      amount: 50000, startMonth: '2026-06', endMonth: '2026-06',
    }
    expect(ScenarioAnalysisInputSchema.safeParse(input([oneOff])).success).toBe(false)
    expect(ScenarioAnalysisInputSchema.safeParse({ ...input(), currency: 'USD' }).success).toBe(false)
  })
})
