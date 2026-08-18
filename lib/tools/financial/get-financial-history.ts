import { z } from 'zod'
import {
  HISTORICAL_METRIC_KEYS,
  readFinancialMetricHistorySeries,
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
  currency: z.enum(['NZD', 'AUD']).optional(),
  sourceLabel: z.string().trim().min(1).max(200).optional(),
  recordLimit: z.union([z.literal(12), z.literal(25), z.literal(50), z.literal('all')]).default(12),
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

  const firstPoint = summary.points[0]
  const latestPoint = summary.points[summary.points.length - 1]
  const lines = [
    `${summary.label} history${summary.metricKey === 'runway_months' ? '' : ` — ${summary.currency}`} (${summary.range}): ${summary.points.length} observation(s) from ${firstPoint.date} to ${latestPoint.date}.`,
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
  { metricKey?: HistoricalMetricKey; range: MetricHistoryRange; currency?: 'NZD' | 'AUD'; sourceLabel?: string; recordLimit?: 12 | 25 | 50 | 'all' },
  string
> {
  return {
    name: 'get_financial_history',
    description:
      'Describe historical movement in cash, monthly revenue, monthly expenses, burn rate, or runway. NZD and AUD are analysed independently and never converted. Set currency only when the user names it. Set sourceLabel only when the user names a statement/source; otherwise report each available currency series without guessing. Leave metricKey empty only for a broad historical summary.',
    inputSchema,
    async handler({ metricKey, range, currency, sourceLabel, recordLimit = 12 }) {
      const metricKeys = metricKey ? [metricKey] : HISTORICAL_METRIC_KEYS
      const collections = await Promise.all(metricKeys.map(async (key) => {
        const initial = await readFinancialMetricHistorySeries({
          userId,
          metricKey: key,
          range,
          recordLimit,
          currency: currency ?? null,
        })
        if (!sourceLabel) return initial

        const source = initial.availableSources.find(
          (option) => option.label.toLowerCase() === sourceLabel.toLowerCase()
        )
        if (!source) return { ...initial, series: [] }

        return readFinancialMetricHistorySeries({
          userId,
          metricKey: key,
          range,
          recordLimit,
          currency: currency ?? null,
          sourceKey: source.key,
        })
      }))
      const availableSummaries = collections.flatMap((collection) => collection.series)

      if (availableSummaries.length === 0) {
        if (sourceLabel) {
          const availableSources = [...new Set(collections.flatMap((collection) => collection.availableSources.map((source) => source.label)))]
          return `No history matched source "${sourceLabel}".${availableSources.length > 0 ? ` Available sources: ${availableSources.join(', ')}.` : ''}`
        }
        return 'No historical financial observations are available yet. Upload at least two dated CSV records to identify a trend.'
      }

      return availableSummaries.map(formatHistorySummary).join('\n\n')
    },
  }
}
