import type { FinancialMetricObservation } from '@/types/database'

export function getFinancialObservationSourceKey(
  observation: FinancialMetricObservation
) {
  const id = observation.connection_id ?? observation.document_id
  return id
    ? `${observation.source_type}:${id}`
    : `${observation.source_type}:label:${observation.source_label}`
}
