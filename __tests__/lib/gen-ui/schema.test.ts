import { GenUiPlanSchema } from '@/lib/gen-ui/schema'
import { GEN_UI_PLAN_VERSION } from '@/lib/gen-ui/types'

describe('Gen UI plan schema', () => {
  it('accepts live metric and data connection widgets', () => {
    const result = GenUiPlanSchema.safeParse({
      version: GEN_UI_PLAN_VERSION,
      source: 'chat',
      generatedAt: '2026-07-19T00:00:00.000Z',
      summary: 'Generated from the latest AI-BOSS chat turn.',
      widgets: [
        {
          id: 'metric-1',
          type: 'metric_snapshot',
          title: 'Relevant metrics',
          reason: 'These metrics support the answer.',
          data: {
            metrics: [
              {
                key: 'runway_months',
                label: 'Runway months',
                value: '5.0',
                unit: 'months',
                sourceLabel: 'CSV: finance.csv',
                sourceTone: 'available',
              },
            ],
          },
        },
        {
          id: 'connections-1',
          type: 'data_connections',
          title: 'Data connections',
          reason: 'The user asked about Xero.',
          data: { message: 'Connect a financial source.' },
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it('requires an explicit supported currency for scenario comparisons', () => {
    const scenario = {
      version: GEN_UI_PLAN_VERSION,
      source: 'chat',
      generatedAt: '2026-08-18T00:00:00.000Z',
      summary: 'Deterministic scenario comparison.',
      widgets: [
        {
          id: 'scenario-1',
          type: 'scenario_comparison',
          title: 'Scenario comparison',
          reason: 'Compare changes to monthly burn.',
          data: {
            currency: 'AUD',
            base: { label: 'Current', monthlyBurn: 20000, runwayMonths: 6 },
            scenarios: [
              {
                label: 'Burn +15%',
                monthlyBurn: 23000,
                runwayMonths: 5.2,
                deltaMonths: -0.8,
              },
            ],
            note: 'Read-only calculation.',
          },
        },
      ],
    }

    expect(GenUiPlanSchema.safeParse(scenario).success).toBe(true)
    expect(
      GenUiPlanSchema.safeParse({
        ...scenario,
        widgets: [
          {
            ...scenario.widgets[0],
            data: { ...scenario.widgets[0].data, currency: 'USD' },
          },
        ],
      }).success
    ).toBe(false)
  })

  it('allows at most five generated widgets', () => {
    const widget = {
      id: 'connections-1',
      type: 'data_connections' as const,
      title: 'Data connections',
      reason: 'The user asked about connected data.',
      data: { message: 'Connect a financial source.' },
    }
    const plan = {
      version: GEN_UI_PLAN_VERSION,
      source: 'chat' as const,
      generatedAt: '2026-09-01T00:00:00.000Z',
      summary: 'Generated from the latest AI-BOSS chat turn.',
    }

    expect(
      GenUiPlanSchema.safeParse({
        ...plan,
        widgets: Array.from({ length: 5 }, (_, index) => ({
          ...widget,
          id: `connections-${index}`,
        })),
      }).success
    ).toBe(true)
    expect(
      GenUiPlanSchema.safeParse({
        ...plan,
        widgets: Array.from({ length: 6 }, (_, index) => ({
          ...widget,
          id: `connections-${index}`,
        })),
      }).success
    ).toBe(false)
  })
})
