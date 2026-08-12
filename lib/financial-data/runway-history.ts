import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'

export interface RunwayTrendSummary {
  observations: AvailableFinancialMetricValue[]
  direction: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  change: number | null
  averageChange: number | null
}

export function getMetricObservationDate(metric: AvailableFinancialMetricValue) {
  return metric.asOfDate ?? metric.periodEnd ?? metric.updatedAt
}

export function summarizeRunwayTrend(
  observations: AvailableFinancialMetricValue[]
): RunwayTrendSummary {
  if (observations.length < 2) {
    return {
      observations,
      direction: 'insufficient_data',
      change: null,
      averageChange: null,
    }
  }

  const first = observations[0].value
  const last = observations[observations.length - 1].value
  const change = Number((last - first).toFixed(2))
  const averageChange = Number(
    (change / (observations.length - 1)).toFixed(2)
  )
  const direction =
    change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable'

  return {
    observations,
    direction,
    change,
    averageChange,
  }
}

export async function readRunwayObservationHistory(userId: string) {
  const { listFinancialMetricObservationHistory } = await import(
    '@/lib/financial-data/persistence'
  )
  const observations = await listFinancialMetricObservationHistory({
    userId,
    metricKey: 'runway_months',
    limit: 6,
  })

  return summarizeRunwayTrend(observations)
}
