import { z } from 'zod'
import {
  HISTORICAL_METRIC_KEYS,
  readFinancialMetricHistory,
  type HistoricalMetricKey,
  type MetricHistoryRange,
  type MetricHistorySummary,
} from '@/lib/financial-data/metric-history'
import type { StructuredTool } from '@/lib/tools/contracts'
import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from '@/lib/financial-data/currency'

const inputSchema = z.object({
  metricKey: z.enum(HISTORICAL_METRIC_KEYS).optional(),
  range: z.enum(['3m', '6m', 'all']).default('all'),
})

function formatValue(value: number, summary: MetricHistorySummary) {
  if (summary.metricKey === 'runway_months') {
    return `${value.toFixed(1)} months`
  }

  if (isSupportedFinancialCurrency(summary.currency)) {
    return formatFinancialCurrency(value, summary.currency)
  }

  return value.toFixed(2)
}

function formatHistorySummary(summary: MetricHistorySummary) {
  if (summary.points.length === 0) {
    return `No ${summary.label.toLowerCase()} history is available yet.`
  }

  if (summary.hasIncompatibleCurrencies) {
    return `${summary.label} history cannot be compared because it contains multiple currencies. AI-BOSS does not convert currencies in historical analysis.`
  }

  const firstPoint = summary.points[0]
  const latestPoint = summary.points[summary.points.length - 1]
  const lines = [
    `${summary.label} history (${summary.range}): ${summary.points.length} observation(s) from ${firstPoint.date} to ${latestPoint.date}.`,
    `Latest value: ${formatValue(latestPoint.value, summary)}.`,
  ]

  if (summary.direction === 'insufficient_data') {
    lines.push('At least 2 observations are needed to identify a trend.')
  } else {
    lines.push(
      `Trend: ${summary.direction}; ${summary.movement} by ${formatValue(Math.abs(summary.totalChange ?? 0), summary)} overall.`
    )
  }

  lines.push(`Sources: ${summary.sourceLabels.join(', ')}.`)

  if (summary.hasMixedSources) {
    lines.push('Warning: this history combines multiple sources; compare it cautiously.')
  }

  if (summary.hasRecordedDateFallback) {
    lines.push('Warning: at least one point uses its recorded/upload date because a financial reporting date was unavailable.')
  }
  if (summary.excludedCurrencyObservationCount > 0) {
    lines.push(
      `Warning: ${summary.excludedCurrencyObservationCount} observation(s) with missing or unsupported currency were excluded from calculations.`
    )
  }

  return lines.join('\n')
}

export function createGetFinancialHistoryTool(
  userId: string
): StructuredTool<
  { metricKey?: HistoricalMetricKey; range: MetricHistoryRange },
  string
> {
  return {
    name: 'get_financial_history',
    description:
      'Describe historical movement in cash, monthly revenue, monthly expenses, burn rate, or runway. Use this for questions about changes over time, whether a metric is improving or worsening, or what changed historically. Leave metricKey empty only for a broad historical summary.',
    inputSchema,
    async handler({ metricKey, range }) {
      const metricKeys = metricKey ? [metricKey] : HISTORICAL_METRIC_KEYS
      const summaries = await Promise.all(
        metricKeys.map((key) =>
          readFinancialMetricHistory({ userId, metricKey: key, range })
        )
      )
      const availableSummaries = summaries.filter((summary) => summary.points.length > 0)

      if (availableSummaries.length === 0) {
        return 'No historical financial observations are available yet. Upload at least two dated CSV records to identify a trend.'
      }

      return availableSummaries.map(formatHistorySummary).join('\n\n')
    },
  }
}
