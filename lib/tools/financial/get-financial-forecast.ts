import { z } from 'zod'
import {
  readFinancialMetricForecast,
  type ForecastHorizon,
  type MetricForecastSummary,
} from '@/lib/financial-data/metric-forecast'
import {
  HISTORICAL_METRIC_KEYS,
  type HistoricalMetricKey,
  type MetricHistoryRange,
} from '@/lib/financial-data/metric-history'
import type { StructuredTool } from '@/lib/tools/contracts'

const inputSchema = z.object({
  metricKey: z.enum(HISTORICAL_METRIC_KEYS).optional(),
  range: z.enum(['3m', '6m', 'all']).default('all'),
  horizon: z.union([z.literal(3), z.literal(6)]).default(3),
})

function formatValue(value: number, summary: MetricForecastSummary) {
  if (summary.metricKey === 'runway_months') return `${value.toFixed(1)} months`

  if (summary.history.currency) {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: summary.history.currency,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return value.toFixed(2)
}

function formatForecast(summary: MetricForecastSummary) {
  if (summary.history.points.length === 0) {
    return `No ${summary.label.toLowerCase()} history is available yet, so AI-BOSS cannot forecast it.`
  }

  if (summary.history.hasIncompatibleCurrencies) {
    return `${summary.label} cannot be forecast because its history contains multiple currencies. AI-BOSS does not convert currencies.`
  }

  if (summary.forecastPoints.length === 0 || summary.monthlySlope === null) {
    return `${summary.label} needs at least 2 dated observations before AI-BOSS can create a forecast.`
  }

  const latestForecast = summary.forecastPoints.at(-1)
  const lines = [
    `${summary.label} ${summary.horizon}-month forecast (${summary.range} history).`,
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

  return lines.join('\n')
}

export function createGetFinancialForecastTool(
  userId: string
): StructuredTool<
  { metricKey?: HistoricalMetricKey; range: MetricHistoryRange; horizon: ForecastHorizon },
  string
> {
  return {
    name: 'get_financial_forecast',
    description:
      'Create a deterministic 3- or 6-month trend-continuation forecast for cash, monthly revenue, monthly expenses, burn rate, or runway. Use this for future-focused questions. Leave metricKey empty only for a broad forecast summary. Forecasts are estimates, not guarantees.',
    inputSchema,
    async handler({ metricKey, range, horizon }) {
      const metricKeys = metricKey ? [metricKey] : HISTORICAL_METRIC_KEYS
      const summaries = await Promise.all(
        metricKeys.map((key) =>
          readFinancialMetricForecast({ userId, metricKey: key, range, horizon })
        )
      )
      const availableSummaries = summaries.filter((summary) => summary.history.points.length > 0)

      if (availableSummaries.length === 0) {
        return 'No historical financial observations are available yet. Upload at least two dated CSV records before creating a forecast.'
      }

      return availableSummaries.map(formatForecast).join('\n\n')
    },
  }
}
