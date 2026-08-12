import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { assessRunwayPolicy } from '@/lib/calculations/runway-policy'
import type { StructuredTool } from '@/lib/tools/contracts'

export function createGetRunwayHistoryTool(userId: string): StructuredTool<Record<string, never>, string> {
  return {
    name: 'get_runway_history',
    description:
      'Retrieves the last 6 financial snapshots and describes how runway, burn rate, and cash have changed over time. ' +
      'Use this when the user asks about: historical performance, whether runway or burn rate is improving or worsening, ' +
      'what changed over recent months, past trends, month-on-month movement, or any question about financial changes over time. ' +
      'Returns each snapshot with its date, runway months, burn rate, and policy status, plus an overall trend summary.',
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
        return 'Failed to fetch financial history. Please try again.'
      }

      if (!data || data.length === 0) {
        return (
          'No financial history found yet. ' +
          'History is recorded each time a runway calculation is saved. ' +
          'Upload financial data and calculate runway to start building a history.'
        )
      }

      const snapshots = [...data].reverse()

      const lines: string[] = [
        `Financial history — last ${snapshots.length} snapshot(s):`,
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
          : 'burn: unavailable'
        const cash = snapshot.cash_balance
          ? `cash: $${Number(snapshot.cash_balance).toLocaleString()}`
          : ''
        const policy = assessRunwayPolicy(Number(snapshot.runway_months))
        lines.push(`  ${date}: ${runway} months runway  |  ${burn}  |  ${cash}  [${policy.status.toUpperCase()}]`)
      }

      if (snapshots.length >= 2) {
        const oldest = Number(snapshots[0].runway_months)
        const newest = Number(snapshots[snapshots.length - 1].runway_months)
        const diff = parseFloat((newest - oldest).toFixed(1))
        const oldestBurn = snapshots[0].burn_rate ? Number(snapshots[0].burn_rate) : null
        const newestBurn = snapshots[snapshots.length - 1].burn_rate ? Number(snapshots[snapshots.length - 1].burn_rate) : null

        lines.push('')
        lines.push('Trend summary:')

        if (diff > 0.5) {
          lines.push(`  Runway is improving — up ${diff} months over this period.`)
        } else if (diff < -0.5) {
          lines.push(`  Runway is declining — down ${Math.abs(diff)} months over this period.`)
        } else {
          lines.push('  Runway has remained broadly stable over this period.')
        }

        if (oldestBurn !== null && newestBurn !== null) {
          const burnDiff = parseFloat((newestBurn - oldestBurn).toFixed(0))
          if (burnDiff > 0) {
            lines.push(`  Burn rate has increased by $${burnDiff.toLocaleString()}/month — monitor closely.`)
          } else if (burnDiff < 0) {
            lines.push(`  Burn rate has decreased by $${Math.abs(burnDiff).toLocaleString()}/month — a positive sign.`)
          }
        }
      }

      return lines.join('\n')
    },
  }
}
