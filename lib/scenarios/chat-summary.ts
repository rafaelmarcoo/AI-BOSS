import { formatFinancialCurrency } from '@/lib/financial-data/currency'
import type { ScenarioAnalysisResult } from '@/lib/scenarios/calculation'

function money(value: number, result: ScenarioAnalysisResult) {
  return formatFinancialCurrency(value, result.currency)
}

export function formatScenarioAnalysisForChat(result: ScenarioAnalysisResult) {
  const lines = [
    '## Deterministic scenario analysis',
    '',
    `**Source:** ${result.sourceLabel} (${result.currency})`,
    `**Projection period:** ${result.projectionStartMonth} for ${result.input.horizon} months`,
    `**Opening available liquidity:** ${money(result.openingLiquidity, result)} (${money(result.openingBridge.cash, result)} cash + ${money(result.openingBridge.accountsReceivable, result)} receivables - ${money(result.openingBridge.accountsPayable, result)} payables)`,
    '',
  ]

  for (const panel of result.panels) {
    lines.push(`### ${panel.label}`, '')
    if (!panel.available) {
      lines.push(panel.unavailableReason ?? 'This calculation method is unavailable.', '')
      continue
    }

    lines.push(
      panel.method === 'current_run_rate'
        ? `Method: starts with opening liquidity and applies the latest monthly burn of ${money(Math.abs(panel.baselineMonthlyMovement ?? 0), result)} each month.`
        : `Method: starts with the same opening liquidity and continues the observed historical cash movement of ${money(panel.baselineMonthlyMovement ?? 0, result)} per month.`,
      ''
    )

    for (const series of panel.series) {
      lines.push(`**${series.label}**`)
      lines.push(`- Ending liquidity: ${money(series.summary.endingLiquidity, result)}`)
      if (series.kind === 'scenario') {
        lines.push(`- Change versus baseline: ${money(series.summary.changeFromBaseline, result)}`)
      }
      lines.push(`- Lowest liquidity: ${money(series.summary.lowestLiquidity, result)}`)
      lines.push(`- Average monthly net movement: ${money(series.summary.averageMonthlyNetMovement, result)}`)
      lines.push(`- Cash-out: ${series.summary.cashOutMonth ? `month ending ${series.summary.cashOutMonth}` : 'does not run out within the selected horizon'}`)
      for (const adjustment of series.resolvedAdjustments) {
        lines.push(`- Assumption: ${adjustment.description}`)
      }
      lines.push('')
    }
  }

  if (result.warnings.length > 0) {
    lines.push('### Warnings', '')
    for (const warning of result.warnings) lines.push(`- ${warning}`)
    lines.push('')
  }

  lines.push('These are deterministic cash-flow projections based on the selected data and assumptions, not guarantees or HR, legal, tax, or employment advice.')
  return lines.join('\n')
}
