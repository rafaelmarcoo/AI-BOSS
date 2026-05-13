import { listLatestFinancialMetricValues } from '@/lib/financial-data/persistence'
import {
  buildRunwayInputFromMetrics,
  fillUnavailableMetrics,
  summarizeMetricAvailability,
  type SourceAwareMetricReadResult,
} from '@/lib/financial-data/read-model'

export async function readSourceAwareMetrics(
  userId: string
): Promise<SourceAwareMetricReadResult> {
  const latestMetrics = await listLatestFinancialMetricValues(userId)
  const metrics = fillUnavailableMetrics(latestMetrics)
  const summary = summarizeMetricAvailability(metrics)

  return {
    metrics,
    ...summary,
    runwayInput: buildRunwayInputFromMetrics(metrics),
  }
}
