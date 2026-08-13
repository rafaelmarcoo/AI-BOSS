import { z } from 'zod'
import { calculateRunway } from '@/lib/calculations/runway'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { isAvailableMetric } from '@/lib/financial-data/metrics'
import type { StructuredTool } from '@/lib/tools/contracts'

const ModelScenarioInputSchema = z.object({
  monthly_cost_change: z
    .number()
    .optional()
    .describe(
      'Optional recurring monthly burn change. Positive means a new cost; negative means a recurring saving.'
    ),
  burn_percentage_change: z
    .number()
    .optional()
    .describe(
      'Optional percentage change to verified monthly burn. Positive means an increase; negative means a reduction. The tool calculates the dollar change.'
    ),
  label: z.string().describe('Short scenario label, such as "new hire" or "reduce marketing".'),
})

type ModelScenarioInput = z.infer<typeof ModelScenarioInputSchema>

function getRunwayCurrency(
  snapshot: Awaited<ReturnType<typeof readSourceAwareMetrics>>
) {
  const runwayMetricKeys = [
    'cash',
    'accounts_receivable',
    'accounts_payable',
    'burn_rate',
  ] as const
  const currencies = runwayMetricKeys.map((key) => {
    const metric = snapshot.metrics[key]
    return isAvailableMetric(metric) ? metric.currency : null
  })

  if (currencies.some((currency) => currency === null)) {
    return null
  }

  return new Set(currencies).size === 1 ? currencies[0] : null
}

export function createModelScenarioTool(
  userId: string
): StructuredTool<ModelScenarioInput, string> {
  return {
    name: 'model_scenario',
    description:
      'Model a read-only what-if scenario by applying a recurring monthly cost change to verified current financial metrics and comparing before/after runway. Use for a new hire, recurring subscription, office cost, cost reduction, or another recurring change. Positive monthly_cost_change is a new expense; negative is a saving. This never changes stored data.',
    inputSchema: ModelScenarioInputSchema,
    async handler({ monthly_cost_change, burn_percentage_change, label }) {
      if (
        (monthly_cost_change === undefined && burn_percentage_change === undefined) ||
        (monthly_cost_change !== undefined && burn_percentage_change !== undefined)
      ) {
        return 'Provide exactly one scenario change: a monthly dollar change or a percentage change to monthly burn.'
      }

      const snapshot = await readSourceAwareMetrics(userId)

      if (!snapshot.runwayInput) {
        return 'Cannot model this scenario because current runway inputs are incomplete. Cash, accounts receivable, accounts payable, and burn rate are required.'
      }

      const currency = getRunwayCurrency(snapshot)
      if (!currency) {
        return (
          'Cannot model this scenario because the runway inputs do not have one confirmed currency. ' +
          'Use complete metrics in the same currency; AI-BOSS does not convert currencies.'
        )
      }

      const { cash, ar, ap, burn } = snapshot.runwayInput
      const percentageChange = burn_percentage_change ?? null
      if (percentageChange !== null && (percentageChange <= -100 || percentageChange > 1000)) {
        return 'The burn percentage change must be greater than -100% and no more than 1000%.'
      }

      const resolvedMonthlyCostChange =
        monthly_cost_change ?? Number(((burn * percentageChange!) / 100).toFixed(2))
      const scenarioBurn = burn + resolvedMonthlyCostChange

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
        resolvedMonthlyCostChange >= 0
          ? `+${resolvedMonthlyCostChange.toLocaleString()} ${currency}/month`
          : `-${Math.abs(resolvedMonthlyCostChange).toLocaleString()} ${currency}/month`
      const percentageLabel =
        percentageChange === null
          ? ''
          : `; ${percentageChange >= 0 ? '+' : ''}${percentageChange}% of current burn`

      return [
        `Scenario: ${label} (${costLabel}${percentageLabel})`,
        `Before: ${before.runway_months} months runway at ${burn.toLocaleString()} ${currency}/month burn.`,
        `After: ${after.runway_months} months runway at ${scenarioBurn.toLocaleString()} ${currency}/month burn.`,
        `Impact: ${runwayDiff >= 0 ? '+' : ''}${runwayDiff} months.`,
        `Assessment: ${after.policy.message}`,
        'This is a modelled scenario only. Stored financial data has not been changed.',
      ].join('\n')
    },
  }
}
