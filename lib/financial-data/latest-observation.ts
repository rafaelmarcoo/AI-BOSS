import type { FinancialMetricObservation } from '@/types/database'

function effectiveReportingDate(row: FinancialMetricObservation) {
  return row.as_of_date ?? row.period_end ?? row.updated_at
}

function compareObservationRecency(
  candidate: FinancialMetricObservation,
  current: FinancialMetricObservation
) {
  const reportingDateComparison = effectiveReportingDate(candidate).localeCompare(
    effectiveReportingDate(current)
  )

  if (reportingDateComparison !== 0) return reportingDateComparison

  const updatedAtComparison = candidate.updated_at.localeCompare(current.updated_at)
  if (updatedAtComparison !== 0) return updatedAtComparison

  const createdAtComparison = candidate.created_at.localeCompare(current.created_at)
  if (createdAtComparison !== 0) return createdAtComparison

  return candidate.id.localeCompare(current.id)
}

/**
 * Selects one current observation per metric using the financial reporting date.
 * Upload timestamps are only tie-breakers because every row in one statement
 * import can share the same updated_at value.
 */
export function selectLatestFinancialMetricObservations(
  rows: FinancialMetricObservation[]
) {
  const latestByMetric = new Map<
    FinancialMetricObservation['metric_key'],
    FinancialMetricObservation
  >()

  for (const row of rows) {
    const current = latestByMetric.get(row.metric_key)

    if (!current || compareObservationRecency(row, current) > 0) {
      latestByMetric.set(row.metric_key, row)
    }
  }

  return [...latestByMetric.values()]
}
