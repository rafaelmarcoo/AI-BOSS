import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { StructuredTool } from '@/lib/tools/contracts'

const URGENT_THRESHOLD = 3
const CAUTION_THRESHOLD = 6
const MAX_FORECAST_MONTHS = 24

/**
 * Factory that creates a forecast_runway_trend tool bound to a specific user.
 * Uses historical snapshots to project when runway may hit critical thresholds.
 */
export function createForecastRunwayTrendTool(userId: string): StructuredTool<Record<string, never>, string> {
  return {
    name: 'forecast_runway_trend',
    description:
      'Analyses historical runway snapshots to project where runway is heading and when it may hit ' +
      'the caution (6 months) or urgent (3 months) threshold. ' +
      'Use this when the user asks about: future runway, cash flow forecasts, financial projections, ' +
      '"when will I run out of money", "where are we headed", "how long do we have", or any forward-looking financial question. ' +
      'Always present the output as an estimate based on current trends, not a guaranteed prediction.',
    inputSchema: z.object({}),
    async handler() {
      const supabase = createAdminSupabaseClient()

      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('snapshot_date, runway_months, burn_rate')
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: true })
        .limit(6)

      if (error) {
        return 'Failed to fetch runway history for forecasting. Please try again.'
      }

      if (!data || data.length < 2) {
        return (
          'Not enough historical data to forecast a trend. ' +
          'At least 2 runway snapshots are needed. ' +
          'Calculate your runway over multiple months to build a history.'
        )
      }

      const runwayValues = data.map(s => Number(s.runway_months))

      // Calculate average monthly change in runway
      const changes: number[] = []
      for (let i = 1; i < runwayValues.length; i++) {
        changes.push(runwayValues[i] - runwayValues[i - 1])
      }
      const avgMonthlyChange = changes.reduce((a, b) => a + b, 0) / changes.length
      const currentRunway = runwayValues[runwayValues.length - 1]
      const currentBurn = data[data.length - 1].burn_rate
        ? `$${Number(data[data.length - 1].burn_rate).toLocaleString()}/month`
        : 'unknown'

      const lines: string[] = [
        `Runway Forecast — based on ${data.length} snapshots`,
        '',
        `Current runway: ${currentRunway.toFixed(1)} months`,
        `Current burn rate: ${currentBurn}`,
        `Average monthly change in runway: ${avgMonthlyChange >= 0 ? '+' : ''}${avgMonthlyChange.toFixed(2)} months/month`,
        '',
      ]

      if (avgMonthlyChange >= 0) {
        lines.push(
          'Trend: Runway is stable or improving. At the current rate, ' +
          'runway is not projected to hit a critical threshold within the next 24 months.'
        )
        return lines.join('\n')
      }

      // Project forward to find when thresholds will be hit
      let projected = currentRunway
      let cautionMonth: number | null = null
      let urgentMonth: number | null = null

      for (let month = 1; month <= MAX_FORECAST_MONTHS; month++) {
        projected += avgMonthlyChange

        if (cautionMonth === null && projected <= CAUTION_THRESHOLD) {
          cautionMonth = month
        }

        if (urgentMonth === null && projected <= URGENT_THRESHOLD) {
          urgentMonth = month
          break
        }
      }

      if (cautionMonth) {
        lines.push(`Caution threshold (6 months): projected in ~${cautionMonth} month(s)`)
      } else {
        lines.push('Caution threshold (6 months): not projected within 24 months')
      }

      if (urgentMonth) {
        lines.push(`Urgent threshold (3 months): projected in ~${urgentMonth} month(s)`)
      } else {
        lines.push('Urgent threshold (3 months): not projected within 24 months')
      }

      lines.push('')
      lines.push(
        'Note: This forecast assumes the current trend continues. ' +
        'Changes in revenue or expenses will affect the actual outcome.'
      )

      return lines.join('\n')
    },
  }
}
