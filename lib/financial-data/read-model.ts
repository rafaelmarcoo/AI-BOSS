import {
  FINANCIAL_METRIC_KEYS,
  type FinancialMetricKey,
} from '@/lib/financial-data/metric-keys'
import {
  createUnavailableMetric,
  getMetricNumber,
  isAvailableMetric,
} from '@/lib/financial-data/metrics'
import type {
  FinancialMetricSet,
  FinancialMetricValue,
} from '@/lib/financial-data/types'
import type { RunwayInput } from '@/lib/calculations/runway'
import {
  isSupportedFinancialCurrency,
  type SupportedFinancialCurrency,
} from '@/lib/financial-data/currency'

export type CompleteFinancialMetricSet = Record<
  FinancialMetricKey,
  FinancialMetricValue
>

export interface SourceAwareMetricReadResult {
  metrics: CompleteFinancialMetricSet
  availableMetricCount: number
  unavailableMetricCount: number
  runwayInput: RunwayInput | null
}

export function fillUnavailableMetrics(
  metrics: FinancialMetricSet,
  updatedAt: string | null = null
): CompleteFinancialMetricSet {
  return FINANCIAL_METRIC_KEYS.reduce((completeMetrics, key) => {
    completeMetrics[key] =
      metrics[key] ??
      createUnavailableMetric({
        key,
        reason: 'not_provided',
        updatedAt,
      })

    return completeMetrics
  }, {} as CompleteFinancialMetricSet)
}

export function buildRunwayInputFromMetrics(
  metrics: FinancialMetricSet
): RunwayInput | null {
  const cash = getMetricNumber(metrics, 'cash')
  const ar = getMetricNumber(metrics, 'accounts_receivable')
  const ap = getMetricNumber(metrics, 'accounts_payable')
  const burn = getMetricNumber(metrics, 'burn_rate')

  const currency = getSharedSupportedCurrency(metrics, [
    'cash',
    'accounts_receivable',
    'accounts_payable',
    'burn_rate',
  ])

  if (
    cash === null ||
    ar === null ||
    ap === null ||
    burn === null ||
    currency === null
  ) {
    return null
  }

  return {
    cash,
    ar,
    ap,
    burn,
  }
}

export function getSharedSupportedCurrency(
  metrics: FinancialMetricSet,
  keys: FinancialMetricKey[]
): SupportedFinancialCurrency | null {
  const currencies = keys.map((key) => {
    const metric = metrics[key]

    return isAvailableMetric(metric) ? metric.currency : null
  })

  if (currencies.some((currency) => !isSupportedFinancialCurrency(currency))) {
    return null
  }

  const supportedCurrencies = currencies as SupportedFinancialCurrency[]

  return new Set(supportedCurrencies).size === 1
    ? supportedCurrencies[0]
    : null
}

export function summarizeMetricAvailability(metrics: FinancialMetricSet) {
  const availableMetricCount = FINANCIAL_METRIC_KEYS.filter((key) =>
    isAvailableMetric(metrics[key])
  ).length

  return {
    availableMetricCount,
    unavailableMetricCount:
      FINANCIAL_METRIC_KEYS.length - availableMetricCount,
  }
}
