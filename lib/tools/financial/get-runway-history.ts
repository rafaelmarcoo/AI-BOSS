import { z } from 'zod'
import {
  getMetricObservationDate,
  readRunwayObservationHistory,
} from '@/lib/financial-data/runway-history'
import type { StructuredTool } from '@/lib/tools/contracts'

export function createGetRunwayHistoryTool(
  userId: string
): StructuredTool<Record<string, never>, string> {
  return {
    name: 'get_runway_history',
    description:
      'Retrieves historical runway observations and describes how runway has changed over time. ' +
      'Use this when the user asks about: historical performance, whether runway or burn rate is improving or worsening, ' +
      'what changed over recent months, past trends, month-on-month movement, or any question about financial changes over time.',
    inputSchema: z.object({}),
    async handler() {
      const summary = await readRunwayObservationHistory(userId)

      if (summary.observations.length === 0) {
        return (
          'No financial history found yet. ' +
          'History is recorded as financial data is uploaded over time. ' +
          'Upload financial data across multiple periods to start building a history.'
        )
      }

      const lines = [
        `Runway history from ${summary.observations.length} observation(s):`,
      ]

      for (const metric of summary.observations) {
        lines.push(
          `- ${getMetricObservationDate(metric)}: ${metric.value} months ` +
            `(source: ${metric.provenance.sourceLabel}, confidence: ${Math.round(metric.confidence * 100)}%)`
        )
      }

      if (summary.direction === 'insufficient_data') {
        lines.push('At least 2 runway observations are needed to describe a trend.')
      } else if (summary.direction === 'stable') {
        lines.push('Trend: runway has stayed flat across these observations.')
      } else {
        lines.push(
          `Trend: runway is ${summary.direction}; total change is ${summary.change} months.`
        )
      }

      return lines.join('\n')
    },
  }
}
