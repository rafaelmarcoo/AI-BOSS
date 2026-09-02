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
      'Describe derived historical cash runway and working-capital-adjusted runway from compatible confirmed observations. Each point requires one source, currency, and reporting date; values are never silently combined.',
    inputSchema: z.object({}),
    async handler() {
      const summary = await readRunwayObservationHistory(userId)

      if (
        summary.observations.length === 0 &&
        summary.workingCapitalAdjusted.observations.length === 0
      ) {
        return 'No derived runway history is available yet. Confirm dated cash and burn values from one source and currency; receivables and payables are also required for the adjusted series.'
      }

      const lines: string[] = []
      for (const [label, trend] of [
        ['Cash runway', summary],
        ['Working-capital-adjusted runway', summary.workingCapitalAdjusted],
      ] as const) {
        lines.push(`${label} history from ${trend.observations.length} calculated point(s):`)
        for (const metric of trend.observations) {
          lines.push(
            `- ${getMetricObservationDate(metric)}: ${metric.value} months ` +
              `(source: ${metric.provenance.sourceLabel}, confidence: ${Math.round(metric.confidence * 100)}%)`
          )
        }
        if (trend.direction === 'insufficient_data') {
          lines.push(`At least 2 compatible ${label.toLowerCase()} points are needed to describe a trend.`)
        } else if (trend.direction === 'stable') {
          lines.push(`Trend: ${label.toLowerCase()} has stayed flat.`)
        } else {
          lines.push(
            `Trend: ${label.toLowerCase()} is ${trend.direction}; total change is ${trend.change} months.`
          )
        }
      }

      return lines.join('\n')
    },
  }
}
