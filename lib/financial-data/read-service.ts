import { listLatestFinancialMetricValues } from '@/lib/financial-data/persistence'
import { listConfirmedDocumentExcludedCandidates } from '@/lib/documents/extraction-review-persistence'
import { isAvailableMetric } from '@/lib/financial-data/metrics'
import { FINANCIAL_METRIC_LABELS } from '@/lib/financial-data/metric-keys'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'
import {
  buildCalculatedRunwayMetric,
  buildRunwayInputFromMetrics,
  buildUnavailableRunwayMetric,
  buildUnavailableWorkingCapitalAdjustedRunwayMetric,
  buildWorkingCapitalAdjustedRunwayMetric,
  fillUnavailableMetrics,
  summarizeMetricAvailability,
  type SourceAwareMetricReadResult,
} from '@/lib/financial-data/read-model'

export async function readSourceAwareMetrics(
  userId: string
): Promise<SourceAwareMetricReadResult> {
  const latestMetrics = await listLatestFinancialMetricValues(userId)
  const runwayInput = buildRunwayInputFromMetrics(latestMetrics)
  const calculatedRunway = buildCalculatedRunwayMetric(latestMetrics)
  let workingCapitalAdjustedRunway =
    buildWorkingCapitalAdjustedRunwayMetric(latestMetrics) ??
    buildUnavailableWorkingCapitalAdjustedRunwayMetric(latestMetrics)

  if (!isAvailableMetric(workingCapitalAdjustedRunway)) {
    const documentMetrics = Object.values(latestMetrics).filter(
      (metric): metric is AvailableFinancialMetricValue =>
        isAvailableMetric(metric) &&
        metric.provenance.sourceType === 'document' &&
        Boolean(metric.provenance.sourceId)
    )
    const documentIds = [
      ...new Set(
        documentMetrics.map((metric) => metric.provenance.sourceId as string)
      ),
    ]
    const latestReportingDate = documentMetrics
      .map((metric) => metric.asOfDate ?? metric.periodEnd)
      .filter((date): date is string => date !== null)
      .sort()
      .at(-1)

    if (documentIds.length > 0 && latestReportingDate) {
      try {
        const excludedCandidates =
          await listConfirmedDocumentExcludedCandidates({
            userId,
            documentIds,
            limit: 200,
          })
        const excludedInputs = excludedCandidates.filter(
          (candidate) =>
            candidate.reporting_date === latestReportingDate &&
            candidate.metric_key !== null &&
            ['cash', 'accounts_receivable', 'accounts_payable', 'burn_rate'].includes(
              candidate.metric_key
            )
        )

        if (excludedInputs.length > 0) {
          const labels = excludedInputs
            .map((candidate) =>
              candidate.metric_key
                ? FINANCIAL_METRIC_LABELS[candidate.metric_key].toLowerCase()
                : 'required input'
            )
            .join(', ')
          const verb = excludedInputs.length === 1 ? 'was' : 'were'
          workingCapitalAdjustedRunway = {
            ...workingCapitalAdjustedRunway,
            detail: `Cannot calculate working-capital-adjusted runway because ${labels} for ${latestReportingDate} ${verb} explicitly excluded during document review.`,
          }
        }
      } catch {
        // Keep the deterministic availability reason when review provenance is unavailable.
      }
    }
  }
  const currentRunway =
    calculatedRunway ??
    latestMetrics.runway_months ??
    buildUnavailableRunwayMetric(latestMetrics)
  const metrics = fillUnavailableMetrics({
    ...latestMetrics,
    runway_months: currentRunway,
  })
  const summary = summarizeMetricAvailability(metrics)

  return {
    metrics,
    ...summary,
    runwayInput,
    workingCapitalAdjustedRunway,
  }
}
