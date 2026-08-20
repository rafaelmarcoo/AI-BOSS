import { z } from 'zod'
import { calculateRatios } from '@/lib/calculations/ratios'
import { getMetricNumber } from '@/lib/financial-data/metrics'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { FINANCIAL_METRIC_LABELS } from '@/lib/financial-data/metric-keys'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { StructuredTool } from '@/lib/tools/contracts'

export function createCalculateRatiosTool(
  userId: string
): StructuredTool<Record<string, never>, string> {
  return {
    name: 'calculate_ratios',
    description:
      'Calculate CIMA financial ratios — gross margin, operating margin, current ratio and debt-to-equity — from the verified metrics stored for this user. ' +
      'Use this for any question about margins, profitability ratios, liquidity, or leverage. ' +
      'The tool performs the arithmetic and reports which ratios cannot be calculated and which metrics they need. ' +
      'Never calculate a ratio yourself; call this instead.',
    inputSchema: z.object({}),
    async handler() {
      const snapshot = await readSourceAwareMetrics(userId)
      const value = (key: FinancialMetricKey) =>
        getMetricNumber(snapshot.metrics, key)

      const { calculated, unavailable } = calculateRatios({
        monthlyRevenue: value('monthly_revenue'),
        costOfSales: value('cost_of_sales'),
        operatingProfit: value('operating_profit'),
        currentAssets: value('current_assets'),
        currentLiabilities: value('current_liabilities'),
        totalDebt: value('total_debt'),
        totalEquity: value('total_equity'),
      })

      if (calculated.length === 0 && unavailable.length === 0) {
        return 'No financial metrics are available yet. Ask the user to upload a statement or connect an accounting source.'
      }

      const lines: string[] = []

      if (calculated.length > 0) {
        lines.push(`Calculated ${calculated.length} ratio(s):`, '')

        for (const ratio of calculated) {
          lines.push(
            `${ratio.label}: ${ratio.value}${ratio.key.endsWith('margin') ? '%' : ''} [${ratio.status}]`,
            `  Working: ${ratio.formula}`,
            `  ${ratio.interpretation}`,
            ''
          )
        }
      }

      if (unavailable.length > 0) {
        lines.push(`Cannot calculate ${unavailable.length} ratio(s):`, '')

        for (const ratio of unavailable) {
          const missing = ratio.missing
            .map((key) =>
              key in FINANCIAL_METRIC_LABELS
                ? FINANCIAL_METRIC_LABELS[key as FinancialMetricKey]
                : key
            )
            .join(', ')

          lines.push(`${ratio.label}: missing ${missing}`)
        }

        lines.push(
          '',
          'State exactly which figures are missing. Do not estimate a ratio from the metrics that are available.'
        )
      }

      return lines.join('\n').trim()
    },
  }
}
