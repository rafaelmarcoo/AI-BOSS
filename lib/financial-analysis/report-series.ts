import type {
  FinancialForecastFact,
  FinancialTrendFact,
} from '@/lib/financial-analysis/types'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'

export const ANALYSIS_REPORT_METRIC_KEYS = [
  'cash',
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
] as const satisfies readonly FinancialMetricKey[]

export type AnalysisReportMetricKey =
  typeof ANALYSIS_REPORT_METRIC_KEYS[number]

export interface AnalysisReportTableRow {
  period: string
  phase: 'Actual' | 'Forecast'
  value: number
}

export interface AnalysisReportChartPoint {
  period: string
  actual: number | null
  forecast: number | null
}

export interface AnalysisReportMetricSeries {
  chartPoints: AnalysisReportChartPoint[]
  tableRows: AnalysisReportTableRow[]
  forecastStartPeriod: string | null
}

function monthStart(month: string) {
  return `${month}-01`
}

export function buildAnalysisReportMetricSeries(params: {
  history: FinancialTrendFact | null
  forecast: FinancialForecastFact | null
}): AnalysisReportMetricSeries {
  const actualRows: AnalysisReportTableRow[] = (params.history?.values ?? []).map(
    (point) => ({
      period: point.date,
      phase: 'Actual',
      value: point.value,
    })
  )
  const forecastRows: AnalysisReportTableRow[] = (params.forecast?.values ?? []).map(
    (point) => ({
      period: monthStart(point.month),
      phase: 'Forecast',
      value: point.value,
    })
  )
  const chartPoints: AnalysisReportChartPoint[] = actualRows.map((row) => ({
    period: row.period,
    actual: row.value,
    forecast: null,
  }))

  // Anchor the dashed forecast to the last recorded value so the transition is
  // visually continuous without duplicating that anchor in the exact-value table.
  const latestActual = chartPoints.at(-1)
  if (latestActual && forecastRows.length > 0) {
    latestActual.forecast = latestActual.actual
  }

  chartPoints.push(...forecastRows.map((row) => ({
    period: row.period,
    actual: null,
    forecast: row.value,
  })))

  return {
    chartPoints,
    tableRows: [...actualRows, ...forecastRows],
    forecastStartPeriod: forecastRows[0]?.period ?? null,
  }
}
