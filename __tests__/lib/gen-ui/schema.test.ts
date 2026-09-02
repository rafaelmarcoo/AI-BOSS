import { GenUiPlanSchema } from '@/lib/gen-ui/schema'
import { GEN_UI_PLAN_VERSION } from '@/lib/gen-ui/types'

describe('Gen UI plan schema', () => {
  it('accepts live metric and data connection widgets', () => {
    const result = GenUiPlanSchema.safeParse({
      version: GEN_UI_PLAN_VERSION,
      source: 'chat',
      generatedAt: '2026-07-19T00:00:00.000Z',
      summary: 'Generated from the latest AI-BOSS chat turn.',
      workspaceMode: 'document_review',
      documentReviewSnapshot: {
        documentIds: ['9d36fa7e-77a3-49dc-be8c-5074a80797db'],
        statusAtGeneration: 'pending',
      },
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

  it('accepts optional metric date and calculation-role context', () => {
    expect(GenUiPlanSchema.safeParse({
      version: GEN_UI_PLAN_VERSION,
      source: 'chat',
      generatedAt: '2026-09-02T00:00:00.000Z',
      summary: 'Date-aware metric context.',
      widgets: [{
        id: 'metric-1',
        type: 'metric_snapshot',
        title: 'Runway inputs',
        reason: 'Date-aware context.',
        data: {
          metrics: [{
            key: 'accounts_receivable',
            label: 'Accounts receivable',
            value: 'NZD 18,000',
            unit: null,
            sourceLabel: 'Document: finance.csv',
            sourceTone: 'available',
            reportingDate: '2026-04-30',
            dateStatus: 'latest_recorded',
            calculationRole: 'context_only',
            detail: 'Does not match the 2026-05-31 runway calculation date.',
          }],
        },
      }],
    }).success).toBe(true)
  })
})
