import { z } from 'zod'
import {
  readRunwayObservationHistory,
} from '@/lib/financial-data/runway-history'
import type { StructuredTool } from '@/lib/tools/contracts'

const URGENT_THRESHOLD = 3
const CAUTION_THRESHOLD = 6
const MAX_FORECAST_PERIODS = 24

export function createForecastRunwayTrendTool(
  userId: string
): StructuredTool<Record<string, never>, string> {
  return {
    name: 'forecast_runway_trend',
    description:
      'Estimate where runway may head if the observed runway_months trend continues. Use cautious wording because this is a rough continuation estimate, not a prediction.',
    inputSchema: z.object({}),
    async handler() {
      const summary = await readRunwayObservationHistory(userId)

      if (summary.observations.length < 2 || summary.averageChange === null) {
        return 'Not enough runway history to forecast a trend. At least 2 runway observations are required.'
      }

      const currentRunway =
        summary.observations[summary.observations.length - 1].value
      const lines = [
        `Rough runway trend estimate based on ${summary.observations.length} observations.`,
        `Current runway: ${currentRunway} months.`,
        `Average observed change: ${summary.averageChange >= 0 ? '+' : ''}${summary.averageChange} months per observation.`,
      ]

      if (summary.averageChange >= 0) {
        lines.push(
          'If this pattern continues, runway is not moving toward the caution or urgent thresholds.'
        )
        lines.push('This is a rough continuation estimate, not a prediction.')
        return lines.join('\n')
      }

      let projected = currentRunway
      let cautionPeriod: number | null = null
      let urgentPeriod: number | null = null

      for (let period = 1; period <= MAX_FORECAST_PERIODS; period += 1) {
        projected += summary.averageChange

        if (cautionPeriod === null && projected <= CAUTION_THRESHOLD) {
          cautionPeriod = period
        }

        if (urgentPeriod === null && projected <= URGENT_THRESHOLD) {
          urgentPeriod = period
          break
        }
      }

      lines.push(
        cautionPeriod === null
          ? 'Caution threshold: not reached within the next 24 observations.'
          : `Caution threshold (6 months): could be reached in about ${cautionPeriod} observation(s).`
      )
      lines.push(
        urgentPeriod === null
          ? 'Urgent threshold: not reached within the next 24 observations.'
          : `Urgent threshold (3 months): could be reached in about ${urgentPeriod} observation(s).`
      )
      lines.push('This is a rough continuation estimate, not a prediction.')

      return lines.join('\n')
    },
  }
}
