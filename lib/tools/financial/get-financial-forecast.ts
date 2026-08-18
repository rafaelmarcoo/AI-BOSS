import { z } from 'zod'
import {
  readFinancialMetricForecastSeries,
  type ForecastHorizon,
  type MetricForecastSummary,
} from '@/lib/financial-data/metric-forecast'
import {
  HISTORICAL_METRIC_KEYS,
  type HistoricalMetricKey,
  type MetricHistoryRange,
} from '@/lib/financial-data/metric-history'
import type { StructuredTool } from '@/lib/tools/contracts'
import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from '@/lib/financial-data/currency'

const inputSchema = z.object({
  metricKey: z.enum(HISTORICAL_METRIC_KEYS).optional(),
  range: z.enum(['3m', '6m', 'all']).default('all'),
  horizon: z.union([z.literal(3), z.literal(6)]).default(3),
  currency: z.enum(['NZD', 'AUD']).optional(),
  sourceLabel: z.string().trim().min(1).max(200).optional(),
  recordLimit: z.union([z.literal(12), z.literal(25), z.literal(50), z.literal('all')]).default(12),
})

function formatValue(value: number, summary: MetricForecastSummary) {
  if (summary.metricKey === 'runway_months') return `${value.toFixed(1)} months`

  if (isSupportedFinancialCurrency(summary.history.currency)) {
    return formatFinancialCurrency(value, summary.history.currency)
  }

  return value.toFixed(2)
}

function formatForecast(summary: MetricForecastSummary) {
  if (summary.history.points.length === 0) {
    return `No ${summary.label.toLowerCase()} history is available yet, so AI-BOSS cannot forecast it.`
  }

  if (summary.forecastPoints.length === 0 || summary.monthlySlope === null) {
    return `${summary.label} needs at least 2 dated observations before AI-BOSS can create a forecast.`
  }

  const latestForecast = summary.forecastPoints.at(-1)
  const lines = [
    `${summary.label}${summary.metricKey === 'runway_months' ? '' : ` — ${summary.history.currency}`} ${summary.horizon}-month forecast (${summary.range} history).`,
    `Latest actual: ${formatValue(summary.latestActualValue ?? 0, summary)}.`,
    `Observed trend: ${summary.monthlySlope >= 0 ? '+' : ''}${formatValue(summary.monthlySlope, summary)} per month.`,
    `Projected ${latestForecast?.date}: ${formatValue(latestForecast?.value ?? 0, summary)}.`,
    'This continues the observed historical trend and is not a guaranteed prediction.',
  ]

  if (summary.history.hasMixedSources) {
    lines.push('Warning: the historical inputs combine multiple sources; compare the projection cautiously.')
  }
  if (summary.history.hasRecordedDateFallback) {
    lines.push('Warning: at least one input uses its recorded/upload date because a reporting date was unavailable.')
  }
  if (summary.history.excludedCurrencyObservationCount > 0) {
    lines.push(
      `Warning: ${summary.history.excludedCurrencyObservationCount} observation(s) with missing or unsupported currency were excluded from the forecast.`
    )
  }

  return lines.join('\n')
}

export function createGetFinancialForecastTool(
  userId: string
): StructuredTool<
  { metricKey?: HistoricalMetricKey; range: MetricHistoryRange; horizon: ForecastHorizon; currency?: 'NZD' | 'AUD'; sourceLabel?: string; recordLimit?: 12 | 25 | 50 | 'all' },
  string
> {
  return {
    name: 'get_financial_forecast',
    description:
      'Create a deterministic 3- or 6-month trend-continuation forecast for cash, monthly revenue, monthly expenses, burn rate, or runway. NZD and AUD are forecast independently and never converted. Set currency or sourceLabel only when the user explicitly supplies that context. Leave metricKey empty only for a broad forecast summary. Forecasts are estimates, not guarantees.',
    inputSchema,
    async handler({ metricKey, range, horizon, currency, sourceLabel, recordLimit = 12 }) {
      const metricKeys = metricKey ? [metricKey] : HISTORICAL_METRIC_KEYS
      const collections = await Promise.all(metricKeys.map(async (key) => {
        const initial = await readFinancialMetricForecastSeries({
          userId,
          metricKey: key,
          range,
          horizon,
          recordLimit,
          currency: currency ?? null,
        })
        if (!sourceLabel) return initial

        const source = initial.availableSources.find(
          (option) => option.label.toLowerCase() === sourceLabel.toLowerCase()
        )
        if (!source) return { ...initial, series: [] }

        return readFinancialMetricForecastSeries({
          userId,
          metricKey: key,
          range,
          horizon,
          recordLimit,
          currency: currency ?? null,
          sourceKey: source.key,
        })
      }))
      const availableSummaries = collections.flatMap((collection) => collection.series)

      if (availableSummaries.length === 0) {
        if (sourceLabel) {
          const availableSources = [...new Set(collections.flatMap((collection) => collection.availableSources.map((source) => source.label)))]
          return `No forecast history matched source "${sourceLabel}".${availableSources.length > 0 ? ` Available sources: ${availableSources.join(', ')}.` : ''}`
        }
        return 'No historical financial observations are available yet. Upload at least two dated CSV records before creating a forecast.'
      }

      return availableSummaries.map(formatForecast).join('\n\n')
    },
  }
}
