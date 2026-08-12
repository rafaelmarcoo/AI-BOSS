import { z } from 'zod'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { calculateRunway } from '@/lib/calculations/runway'
import type { StructuredTool } from '@/lib/tools/contracts'

const ModelScenarioInputSchema = z.object({
  monthly_cost_change: z
    .number()
    .describe('Monthly cost change to model in dollars. Positive = new expense, negative = saving.'),
  label: z
    .string()
    .describe('Short label for this scenario, e.g. "new hire", "office lease", "cut marketing".'),
})

type ModelScenarioInput = z.infer<typeof ModelScenarioInputSchema>

/**
 * Factory that creates a model_scenario tool bound to a specific user.
 * Fetches the user's current metrics, then shows before/after runway
 * impact of a proposed recurring cost change.
 */
export function createModelScenarioTool(userId: string): StructuredTool<ModelScenarioInput, string> {
  return {
    name: 'model_scenario',
    description:
      'Models a what-if financial scenario by applying a recurring monthly cost change and comparing before/after runway impact. ' +
      'Use this when the user asks about: hiring a new employee, adding a subscription or expense, cutting a cost, ' +
      'leasing office space, making any recurring spending change, or any question starting with "what if" or "what would happen if". ' +
      'Pass a positive monthly_cost_change for new expenses, negative for savings or cost cuts. ' +
      'Always include a clear label so the output is readable (e.g. "new hire", "office lease", "cut marketing spend").',
    inputSchema: ModelScenarioInputSchema,
    async handler({ monthly_cost_change, label }) {
      const snapshot = await readSourceAwareMetrics(userId)

      if (!snapshot.runwayInput) {
        return (
          'Cannot model scenario: financial data is incomplete. ' +
          'Cash, accounts receivable, accounts payable, and burn rate are all required.'
        )
      }

      const { cash, ar, ap, burn } = snapshot.runwayInput

      const before = calculateRunway({ cash, ar, ap, burn })
      const after = calculateRunway({ cash, ar, ap, burn: burn + monthly_cost_change })

      const runwayDiff = parseFloat((after.runway_months - before.runway_months).toFixed(2))
      const diffLabel = runwayDiff >= 0 ? `+${runwayDiff}` : `${runwayDiff}`
      const costLabel = monthly_cost_change >= 0
        ? `+$${monthly_cost_change.toLocaleString()}/month`
        : `-$${Math.abs(monthly_cost_change).toLocaleString()}/month`

      const lines = [
        `Scenario: "${label}" (${costLabel})`,
        '',
        `Before: ${before.runway_months} months runway  |  Burn: $${burn.toLocaleString()}/month`,
        `After:  ${after.runway_months} months runway  |  Burn: $${(burn + monthly_cost_change).toLocaleString()}/month`,
        `Impact: ${diffLabel} months`,
        '',
        `Assessment: ${after.policy.message}`,
        '',
        'Note: This is a modelled scenario only. Your actual financial data has not been changed.',
      ]

      return lines.join('\n')
    },
  }
}
