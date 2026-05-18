import { z } from 'zod'
import { calculateRunway } from '@/lib/calculations/runway'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import type { StructuredTool } from '@/lib/tools/contracts'

const ModelScenarioInputSchema = z.object({
  monthly_cost_change: z
    .number()
    .describe(
      'Recurring monthly burn change. Positive means a new cost; negative means a saving or revenue improvement.'
    ),
  label: z.string().describe('Short scenario label.'),
})

type ModelScenarioInput = z.infer<typeof ModelScenarioInputSchema>

export function createModelScenarioTool(
  userId: string
): StructuredTool<ModelScenarioInput, string> {
  return {
    name: 'model_scenario',
    description:
      'Model a simple what-if scenario by applying a recurring monthly burn change to the current financial metrics and comparing before/after runway. This is read-only and does not change stored data.',
    inputSchema: ModelScenarioInputSchema,
    async handler({ monthly_cost_change, label }) {
      const snapshot = await readSourceAwareMetrics(userId)

      if (!snapshot.runwayInput) {
        return 'Cannot model this scenario because current runway inputs are incomplete. Cash, accounts receivable, accounts payable, and burn rate are required.'
      }

      const { cash, ar, ap, burn } = snapshot.runwayInput
      const scenarioBurn = burn + monthly_cost_change

      if (scenarioBurn <= 0) {
        return (
          `Cannot model "${label}" because the resulting monthly burn would be ${scenarioBurn}. ` +
          'Runway requires a monthly burn greater than zero. Treat this as a break-even or cash-positive scenario instead.'
        )
      }

      const before = calculateRunway({ cash, ar, ap, burn })
      const after = calculateRunway({ cash, ar, ap, burn: scenarioBurn })
      const runwayDiff = Number(
        (after.runway_months - before.runway_months).toFixed(2)
      )
      const costLabel =
        monthly_cost_change >= 0
          ? `+${monthly_cost_change.toLocaleString()}/month`
          : `-${Math.abs(monthly_cost_change).toLocaleString()}/month`

      return [
        `Scenario: ${label} (${costLabel})`,
        `Before: ${before.runway_months} months runway at ${burn.toLocaleString()}/month burn.`,
        `After: ${after.runway_months} months runway at ${scenarioBurn.toLocaleString()}/month burn.`,
        `Impact: ${runwayDiff >= 0 ? '+' : ''}${runwayDiff} months.`,
        `Assessment: ${after.policy.message}`,
        'This is a modelled scenario only. Stored financial data was not changed.',
      ].join('\n')
    },
  }
}
