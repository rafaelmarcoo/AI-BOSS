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
})
