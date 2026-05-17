import { z } from 'zod'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import type { StructuredTool } from '@/lib/tools/contracts'

/**
 * Factory that creates a get_latest_snapshot tool bound to a specific user.
 * The tool fetches the user's latest financial metrics from the database so
 * the agent can answer financial questions without requiring the user to
 * manually provide their numbers.
 */
export function createGetLatestSnapshotTool(userId: string): StructuredTool<Record<string, never>, string> {
  return {
    name: 'get_latest_snapshot',
    description:
      'Fetches the latest financial metrics for the current user from the database. ' +
      'Returns available metrics including cash, accounts receivable, accounts payable, ' +
      'burn rate, and revenue with their data source and confidence. ' +
      'Always call this first before calculating runway so you are using real data, not assumed values.',
    inputSchema: z.object({}),
    async handler() {
      const result = await readSourceAwareMetrics(userId)

      if (result.availableMetricCount === 0) {
        return (
          'No financial data found for this user. ' +
          'They have not connected a data source or uploaded financial documents yet. ' +
          'Ask them to upload a CSV or connect Xero to get started.'
        )
      }

      const lines: string[] = [
        `Financial snapshot — ${result.availableMetricCount} metric(s) available:`,
      ]

      for (const metric of Object.values(result.metrics)) {
        if (metric.status === 'available') {
          lines.push(
            `- ${metric.key}: ${metric.value}${metric.currency ? ` ${metric.currency}` : ''} ` +
            `(source: ${metric.provenance.sourceLabel}, confidence: ${Math.round(metric.confidence * 100)}%)`
          )
        }
      }

      if (result.runwayInput) {
        lines.push(
          '\nAll runway inputs are available. ' +
          `Call calculate_runway with: cash=${result.runwayInput.cash}, ` +
          `ar=${result.runwayInput.ar}, ap=${result.runwayInput.ap}, burn=${result.runwayInput.burn}`
        )
      } else {
        lines.push(
          `\n${result.unavailableMetricCount} metric(s) are missing. ` +
          'Cannot calculate runway until cash, accounts_receivable, accounts_payable, and burn_rate are all available.'
        )
      }

      return lines.join('\n')
    },
  }
}
