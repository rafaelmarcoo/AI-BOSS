import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type {
  AvailableFinancialMetricValue,
  FinancialMetricAvailabilityReason,
  FinancialMetricSet,
  FinancialMetricSourceType,
  FinancialMetricValue,
  UnavailableFinancialMetricValue,
} from '@/lib/financial-data/types'

export function createUnavailableMetric(params: {
  key: FinancialMetricKey
  reason: FinancialMetricAvailabilityReason
  sourceType?: FinancialMetricSourceType | null
  sourceLabel?: string | null
  updatedAt?: string | null
  detail?: string
}): UnavailableFinancialMetricValue {
  return {
    status: 'unavailable',
    key: params.key,
    reason: params.reason,
    sourceType: params.sourceType ?? null,
    sourceLabel: params.sourceLabel ?? null,
    updatedAt: params.updatedAt ?? null,
    ...(params.detail ? { detail: params.detail } : {}),
  }
}

export function isAvailableMetric(
  metric: FinancialMetricValue | null | undefined
): metric is AvailableFinancialMetricValue {
  return metric?.status === 'available'
}

export function isUnavailableMetric(
  metric: FinancialMetricValue | null | undefined
): metric is UnavailableFinancialMetricValue {
  return metric?.status === 'unavailable'
}

export function getMetricNumber(
  metrics: FinancialMetricSet,
  key: FinancialMetricKey
) {
  const metric = metrics[key]

  return isAvailableMetric(metric) ? metric.value : null
}
