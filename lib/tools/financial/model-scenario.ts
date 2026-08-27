import { z } from 'zod'
import type { StructuredTool } from '@/lib/tools/contracts'
import { ScenarioAnalysisInputSchema } from '@/lib/scenarios/schema'
import { analyseScenario, listScenarioBaselineOptions } from '@/lib/scenarios/service'
import type { ScenarioAnalysisResult } from '@/lib/scenarios/calculation'

const ModelScenarioInputSchema = ScenarioAnalysisInputSchema.extend({
  sourceKey: z.string().min(1).optional().describe(
    'Exact source key when already confirmed. Omit it when the user has not selected a source; the tool will use a unique valid source or request clarification.'
  ),
  currency: z.enum(['NZD', 'AUD']).optional().describe(
    'Confirmed scenario currency. Omit it when not confirmed; the tool will use a unique valid currency or request clarification.'
  ),
})

type ModelScenarioInput = z.infer<typeof ModelScenarioInputSchema>

function normalizeScenarioSemantics(input: ModelScenarioInput): ModelScenarioInput {
  return {
    ...input,
    scenarios: input.scenarios.map((scenario) => {
      const isStaffReduction = /\b(?:fir(?:e|ed|ing)|dismiss(?:al|ed|ing)?|layoff|lay off|redundan(?:cy|t|cies))\b/i.test(scenario.label)
      if (!isStaffReduction) return scenario

      return {
        ...scenario,
        adjustments: scenario.adjustments.map((adjustment) => {
          const describesRemovedEmploymentCost = /\b(?:employee|employer|salary|wage|monthly cost|monthly saving)\b/i.test(adjustment.label)
          if (
            adjustment.kind === 'fixed' &&
            adjustment.frequency === 'recurring' &&
            adjustment.flow === 'outflow' &&
            describesRemovedEmploymentCost
          ) {
            return { ...adjustment, flow: 'inflow' as const }
          }
          return adjustment
        }),
      }
    }),
  }
}

export type ModelScenarioToolResult =
  | { status: 'ready'; result: ScenarioAnalysisResult }
  | {
      status: 'needs_input'
      field: 'source_currency' | 'baseline' | 'assumptions'
      message: string
      options?: Array<{ sourceKey: string; sourceLabel: string; currency: 'NZD' | 'AUD' }>
    }

export function createModelScenarioTool(
  userId: string
): StructuredTool<ModelScenarioInput, ModelScenarioToolResult> {
  return {
    name: 'model_scenario',
    description:
      'Model one to three read-only financial scenarios over 3, 6, 12, or 24 months. Supports fixed one-off or recurring inflows/outflows and fixed or compounding percentage changes to stored revenue, expenses, or burn. Every scenario requires explicit monthly timing. The tool uses one owned source and one NZD or AUD currency, calculates current-run-rate and historical-trend comparisons in trusted code, and never changes stored financial data.',
    inputSchema: ModelScenarioInputSchema,
    async handler(input) {
      const options = await listScenarioBaselineOptions(userId)
      const candidates = options.filter((option) =>
        (!input.sourceKey || option.sourceKey === input.sourceKey) &&
        (!input.currency || option.currency === input.currency)
      )

      if (candidates.length !== 1) {
        return {
          status: 'needs_input',
          field: 'source_currency',
          message: candidates.length === 0
            ? 'No matching source and supported currency are available. Ask the user to select an uploaded statement and NZD or AUD currency.'
            : 'More than one source or currency is available. Ask the user to choose exactly one before calculating.',
          options: candidates.map(({ sourceKey, sourceLabel, currency }) => ({
            sourceKey,
            sourceLabel,
            currency,
          })),
        }
      }

      try {
        const result = await analyseScenario(userId, {
          ...normalizeScenarioSemantics(input),
          sourceKey: candidates[0].sourceKey,
          currency: candidates[0].currency,
        })
        return { status: 'ready', result }
      } catch (error) {
        return {
          status: 'needs_input',
          field: error instanceof z.ZodError ? 'assumptions' : 'baseline',
          message: error instanceof Error
            ? error.message
            : 'The scenario could not be calculated from the confirmed inputs.',
        }
      }
    },
  }
}
