import { isSupportedFinancialCurrency } from '@/lib/financial-data/currency'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import { getFinancialObservationSourceKey } from '@/lib/financial-data/source-key'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { FinancialMetricObservation } from '@/types/database'

export interface FinancialAnalysisBaselineOption {
  sourceKey: string
  sourceLabel: string
  sourceType: FinancialMetricObservation['source_type']
  currency: 'NZD' | 'AUD'
  availableMetricKeys: FinancialMetricKey[]
  observationCount: number
  latestReportingDate: string
}

function effectiveDate(observation: FinancialMetricObservation) {
  return observation.as_of_date ??
    observation.period_end ??
    observation.updated_at.slice(0, 10)
}

export function buildFinancialAnalysisBaselineOptions(
  observations: FinancialMetricObservation[]
): FinancialAnalysisBaselineOption[] {
  const grouped = new Map<string, FinancialMetricObservation[]>()

  for (const observation of observations) {
    if (!isSupportedFinancialCurrency(observation.currency)) continue
    const sourceKey = getFinancialObservationSourceKey(observation)
    const groupKey = JSON.stringify([sourceKey, observation.currency])
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), observation])
  }

  return [...grouped.values()]
    .map((rows) => {
      const first = rows[0]
      const latestReportingDate = rows
        .map(effectiveDate)
        .sort((left, right) => right.localeCompare(left))[0]
      const availableMetricKeys = FINANCIAL_METRIC_KEYS.filter((metricKey) =>
        rows.some((row) => row.metric_key === metricKey)
      )

      return {
        sourceKey: getFinancialObservationSourceKey(first),
        sourceLabel: first.source_label,
        sourceType: first.source_type,
        currency: first.currency as 'NZD' | 'AUD',
        availableMetricKeys,
        observationCount: rows.length,
        latestReportingDate,
      }
    })
    .sort((left, right) =>
      left.sourceLabel.localeCompare(right.sourceLabel) ||
      left.currency.localeCompare(right.currency)
    )
}

export async function listFinancialAnalysisBaselineOptions(userId: string) {
  const { listFinancialMetricObservations } = await import(
    '@/lib/financial-data/persistence'
  )
  return buildFinancialAnalysisBaselineOptions(
    await listFinancialMetricObservations(userId)
  )
}
