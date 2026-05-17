import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { assessRunwayPolicy } from '@/lib/calculations/runway-policy'
import type { StructuredTool } from '@/lib/tools/contracts'

/**
 * Factory that creates a get_runway_history tool bound to a specific user.
 * Reads the last 6 financial snapshots so the agent can describe runway trends.
 */
export function createGetRunwayHistoryTool(userId: string): StructuredTool<Record<string, never>, string> {
  return {
    name: 'get_runway_history',
    description:
      'Fetches the last 6 runway snapshots for the current user so the agent can describe ' +
      'how runway has changed over time. Use this when the user asks about trends, ' +
      'history, or whether their runway is improving or declining.',
    inputSchema: z.object({}),
    async handler() {
      const supabase = createAdminSupabaseClient()

      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('snapshot_date, runway_months, burn_rate, cash_balance')
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: false })
        .limit(6)

      if (error) {
        return 'Failed to fetch runway history. Please try again.'
      }

      if (!data || data.length === 0) {
        return (
          'No runway history found. ' +
          'Runway history is recorded each time a calculation is saved. ' +
          'Ask the user to calculate their runway first to start building a history.'
        )
      }

      // Reverse so oldest is first for trend reading
      const snapshots = [...data].reverse()

      const lines: string[] = [
        `Runway history — last ${snapshots.length} snapshot(s):`,
        '',
      ]

      for (const snapshot of snapshots) {
        const date = new Date(snapshot.snapshot_date).toLocaleDateString('en-NZ', {
          month: 'short',
          year: 'numeric',
        })
        const runway = Number(snapshot.runway_months).toFixed(1)
        const burn = snapshot.burn_rate
          ? `burn: $${Number(snapshot.burn_rate).toLocaleString()}/mo`
          : ''
        const policy = assessRunwayPolicy(Number(snapshot.runway_months))
        lines.push(`  ${date}: ${runway} months  ${burn}  [${policy.status}]`)
      }

      // Describe trend direction
      if (snapshots.length >= 2) {
        const oldest = Number(snapshots[0].runway_months)
        const newest = Number(snapshots[snapshots.length - 1].runway_months)
        const diff = parseFloat((newest - oldest).toFixed(1))

        lines.push('')
        if (diff > 0) {
          lines.push(`Trend: Runway has improved by ${diff} months over this period.`)
        } else if (diff < 0) {
          lines.push(`Trend: Runway has decreased by ${Math.abs(diff)} months over this period.`)
        } else {
          lines.push('Trend: Runway has remained stable over this period.')
        }
      }

      return lines.join('\n')
    },
  }
}
