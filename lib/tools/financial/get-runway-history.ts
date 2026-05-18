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
      'Describe historical runway movement from runway_months observations. Use this when the user asks whether runway is improving, declining, or changing over time.',
    inputSchema: z.object({}),
    async handler() {
      const summary = await readRunwayObservationHistory(userId)

      if (summary.observations.length === 0) {
        return 'No runway history is available yet. Upload CSVs that include runway months to build history.'
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
