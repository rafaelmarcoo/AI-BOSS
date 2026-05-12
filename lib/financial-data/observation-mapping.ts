import type {
  AvailableFinancialMetricValue,
  FinancialMetricEvidence,
} from '@/lib/financial-data/types'
import type { FinancialMetricObservation } from '@/types/database'

export function mapObservationRowToMetric(
  row: FinancialMetricObservation
): AvailableFinancialMetricValue {
  return {
    status: 'available',
    key: row.metric_key,
    value: row.value,
    currency: row.currency,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    asOfDate: row.as_of_date,
    provenance: {
      sourceType: row.source_type,
      sourceLabel: row.source_label,
      sourceId: row.connection_id ?? row.document_id ?? undefined,
      evidence: row.evidence as FinancialMetricEvidence | undefined,
    },
    confidence: row.confidence,
    updatedAt: row.updated_at,
  }
}
