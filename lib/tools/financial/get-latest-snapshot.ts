import { z } from 'zod'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import type { StructuredTool } from '@/lib/tools/contracts'

export function createGetLatestSnapshotTool(
  userId: string
): StructuredTool<Record<string, never>, string> {
  return {
    name: 'get_latest_snapshot',
    description:
      'Fetch the current calculation-ready financial metrics for the signed-in user, including source and confidence. Use this before answering questions about current cash, revenue, expenses, burn, or runway inputs. Use its stored cash, receivables, payables, and burn values before calling calculate_runway; never invent inputs.',
    inputSchema: z.object({}),
    async handler() {
      const result = await readSourceAwareMetrics(userId)

      if (result.availableMetricCount === 0) {
        return 'No financial metrics are available yet. Ask the user to upload a CSV or connect an accounting source.'
      }

      const lines = [
        `Financial snapshot: ${result.availableMetricCount} metric(s) available, ${result.unavailableMetricCount} unavailable.`,
      ]

      for (const metric of Object.values(result.metrics)) {
        if (metric.status !== 'available') {
          continue
        }

        lines.push(
          `- ${metric.key}: ${metric.value}${metric.currency ? ` ${metric.currency}` : ''} ` +
            `(source: ${metric.provenance.sourceLabel}, confidence: ${Math.round(metric.confidence * 100)}%)`
        )
      }

      if (result.runwayInput) {
        lines.push(
          `Confirmed runway inputs: cash=${result.runwayInput.cash}, ar=${result.runwayInput.ar}, ap=${result.runwayInput.ap}, burn=${result.runwayInput.burn}.`
        )
      }

      const adjustedRunway = result.workingCapitalAdjustedRunway
      if (adjustedRunway.status === 'available') {
        lines.push(
          `Working-capital-adjusted runway status: AVAILABLE.`,
          `Working-capital-adjusted runway: ${adjustedRunway.value} months (${adjustedRunway.provenance.evidence?.excerpt ?? 'calculated from confirmed inputs'}).`
        )
      } else {
        lines.push(
          'Working-capital-adjusted runway status: UNAVAILABLE.',
          `Reason: ${adjustedRunway.detail ?? 'Working-capital-adjusted runway is unavailable.'}`,
          'Calculation restriction: show the symbolic formula only. Do not substitute mismatched values, call calculate_runway for the adjusted result, or display any numerical working-capital-adjusted runway.'
        )
      }

      return lines.join('\n')
    },
  }
}
