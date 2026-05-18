import { z } from 'zod'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import type { StructuredTool } from '@/lib/tools/contracts'

export function createGetLatestSnapshotTool(
  userId: string
): StructuredTool<Record<string, never>, string> {
  return {
    name: 'get_latest_snapshot',
    description:
      'Fetch the latest source-aware financial metrics for the current user. Use this before answering questions about current cash, burn, revenue, expenses, or available runway inputs.',
    inputSchema: z.object({}),
    async handler() {
      const result = await readSourceAwareMetrics(userId)

      if (result.availableMetricCount === 0) {
        return 'No financial metrics are available yet. Ask the user to upload a CSV or connect an accounting source.'
      }

      const lines = [
        `Latest financial metrics: ${result.availableMetricCount} available, ${result.unavailableMetricCount} unavailable.`,
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
          `Runway inputs available: cash=${result.runwayInput.cash}, ar=${result.runwayInput.ar}, ap=${result.runwayInput.ap}, burn=${result.runwayInput.burn}.`
        )
      } else {
        lines.push(
          'Runway inputs are incomplete. Cash, accounts receivable, accounts payable, and burn rate are required.'
        )
      }

      return lines.join('\n')
    },
  }
}
