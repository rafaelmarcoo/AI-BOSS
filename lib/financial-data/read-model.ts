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
  AvailableFinancialMetricValue,
  FinancialMetricSet,
  FinancialMetricValue,
  UnavailableFinancialMetricValue,
} from '@/lib/financial-data/types'
import type { RunwayInput } from '@/lib/calculations/runway'
import { calculateRunway } from '@/lib/calculations/runway'
import {
  isSupportedFinancialCurrency,
  type SupportedFinancialCurrency,
} from '@/lib/financial-data/currency'

const RUNWAY_INPUT_KEYS = [
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'burn_rate',
] as const satisfies readonly FinancialMetricKey[]

const CASH_RUNWAY_INPUT_KEYS = [
  'cash',
  'burn_rate',
] as const satisfies readonly FinancialMetricKey[]

export type CompleteFinancialMetricSet = Record<
  FinancialMetricKey,
  FinancialMetricValue
>

export interface SourceAwareMetricReadResult {
  metrics: CompleteFinancialMetricSet
  availableMetricCount: number
  unavailableMetricCount: number
  runwayInput: RunwayInput | null
  workingCapitalAdjustedRunway: FinancialMetricValue
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
  return assessWorkingCapitalRunwayMetrics(metrics).input
}

function getMetricReportingDate(metric: AvailableFinancialMetricValue) {
  return metric.asOfDate ?? metric.periodEnd
}

function getMetricSourceKey(metric: AvailableFinancialMetricValue) {
  return `${metric.provenance.sourceType}:${metric.provenance.sourceId ?? `label:${metric.provenance.sourceLabel}`}`
}

function assessCashRunwayMetrics(metrics: FinancialMetricSet) {
  const inputs = CASH_RUNWAY_INPUT_KEYS.map((key) => metrics[key])
  const missingKeys = CASH_RUNWAY_INPUT_KEYS.filter(
    (key) => !isAvailableMetric(metrics[key])
  )

  if (missingKeys.length > 0) {
    return {
      input: null,
      context: null,
      reason: 'not_provided' as const,
      detail: `Cannot calculate cash runway: missing ${missingKeys.map((key) => key.replaceAll('_', ' ')).join(', ')}.`,
    }
  }

  const availableInputs = inputs as AvailableFinancialMetricValue[]
  const currencies = availableInputs.map((metric) => metric.currency)
  const supportedCurrencies = currencies.filter(isSupportedFinancialCurrency)
  const sourceKeys = new Set(availableInputs.map(getMetricSourceKey))
  const reportingDates = availableInputs.map(getMetricReportingDate)

  if (
    supportedCurrencies.length !== currencies.length ||
    new Set(supportedCurrencies).size !== 1
  ) {
    return {
      input: null,
      context: null,
      reason: 'incompatible_currency' as const,
      detail:
        'Cannot calculate cash runway: cash and burn must use the same supported NZD or AUD currency.',
    }
  }

  if (sourceKeys.size !== 1) {
    return {
      input: null,
      context: null,
      reason: 'incompatible_source' as const,
      detail:
        'Cannot calculate cash runway: the latest cash and burn values come from different sources.',
    }
  }

  if (
    reportingDates.some((date) => date === null) ||
    new Set(reportingDates).size !== 1
  ) {
    return {
      input: null,
      context: null,
      reason: 'incompatible_reporting_date' as const,
      detail:
        'Cannot calculate cash runway: the latest cash and burn values do not share one reporting date.',
    }
  }

  const input = {
    cash: getMetricNumber(metrics, 'cash') as number,
    ar: 0,
    ap: 0,
    burn: getMetricNumber(metrics, 'burn_rate') as number,
  }

  if (
    input.cash < 0 ||
    input.burn <= 0 ||
    !Object.values(input).every(Number.isFinite)
  ) {
    return {
      input: null,
      context: null,
      reason: 'invalid_input' as const,
      detail:
        'Cannot calculate cash runway: cash must be non-negative and monthly burn must be greater than zero.',
    }
  }

  return {
    input,
    reason: null,
    detail: null,
    context: {
      reportingDate: reportingDates[0] as string,
      source: availableInputs[0].provenance,
      confidence: Math.min(...availableInputs.map((metric) => metric.confidence)),
      updatedAt: availableInputs
        .map((metric) => metric.updatedAt)
        .sort()
        .at(-1) as string,
    },
  }
}

function assessWorkingCapitalRunwayMetrics(metrics: FinancialMetricSet) {
  const inputs = RUNWAY_INPUT_KEYS.map((key) => metrics[key])
  const missingKeys = RUNWAY_INPUT_KEYS.filter((key) => !isAvailableMetric(metrics[key]))

  if (missingKeys.length > 0) {
    return {
      input: null,
      context: null,
      reason: 'not_provided' as const,
      detail: `Cannot calculate runway: missing ${missingKeys.map((key) => key.replaceAll('_', ' ')).join(', ')}.`,
    }
  }

  const availableInputs = inputs as AvailableFinancialMetricValue[]
  const currencies = availableInputs.map((metric) => metric.currency)
  const supportedCurrencies = currencies.filter(isSupportedFinancialCurrency)
  const sourceKeys = new Set(availableInputs.map(getMetricSourceKey))
  const reportingDates = availableInputs.map(getMetricReportingDate)

  if (supportedCurrencies.length !== currencies.length || new Set(supportedCurrencies).size !== 1) {
    return {
      input: null,
      context: null,
      reason: 'incompatible_currency' as const,
      detail: 'Cannot calculate runway: cash, receivables, payables, and burn must all use the same supported NZD or AUD currency.',
    }
  }

  if (sourceKeys.size !== 1) {
    return {
      input: null,
      context: null,
      reason: 'incompatible_source' as const,
      detail: 'Cannot calculate runway: the latest cash, receivables, payables, and burn values come from different sources.',
    }
  }

  if (reportingDates.some((date) => date === null) || new Set(reportingDates).size !== 1) {
    return {
      input: null,
      context: null,
      reason: 'incompatible_reporting_date' as const,
      detail: 'Cannot calculate runway: the latest cash, receivables, payables, and burn values do not share one reporting date.',
    }
  }

  const input = {
    cash: getMetricNumber(metrics, 'cash') as number,
    ar: getMetricNumber(metrics, 'accounts_receivable') as number,
    ap: getMetricNumber(metrics, 'accounts_payable') as number,
    burn: getMetricNumber(metrics, 'burn_rate') as number,
  }

  if (
    input.cash < 0 ||
    input.ar < 0 ||
    input.ap < 0 ||
    input.burn <= 0 ||
    !Object.values(input).every(Number.isFinite)
  ) {
    return {
      input: null,
      context: null,
      reason: 'invalid_input' as const,
      detail: 'Cannot calculate runway: cash, receivables, and payables must be non-negative and monthly burn must be greater than zero.',
    }
  }

  return {
    input,
    reason: null,
    detail: null,
    context: {
      currency: supportedCurrencies[0],
      reportingDate: reportingDates[0] as string,
      source: availableInputs[0].provenance,
      confidence: Math.min(...availableInputs.map((metric) => metric.confidence)),
      updatedAt: availableInputs
        .map((metric) => metric.updatedAt)
        .sort()
        .at(-1) as string,
    },
  }
}

/**
 * Builds the current operational runway from compatible confirmed inputs.
 * This is a calculated view value, not a new financial observation.
 */
export function buildCalculatedRunwayMetric(
  metrics: FinancialMetricSet
): AvailableFinancialMetricValue | null {
  const assessment = assessCashRunwayMetrics(metrics)
  const { input, context } = assessment

  if (!input || !context) return null

  const result = calculateRunway(input)

  return {
    status: 'available',
    key: 'runway_months',
    value: result.runway_months,
    currency: null,
    periodStart: null,
    periodEnd: null,
    asOfDate: context.reportingDate,
    provenance: {
      ...context.source,
      sourceLabel: `${context.source.sourceLabel} (cash runway calculated)`,
      evidence: {
        ...context.source.evidence,
        excerpt: result.calculation_breakdown.formula,
      },
    },
    confidence: context.confidence,
    updatedAt: context.updatedAt,
  }
}

export function buildWorkingCapitalAdjustedRunwayMetric(
  metrics: FinancialMetricSet
): AvailableFinancialMetricValue | null {
  const assessment = assessWorkingCapitalRunwayMetrics(metrics)
  const { input, context } = assessment

  if (!input || !context) return null

  const result = calculateRunway(input)

  return {
    status: 'available',
    key: 'runway_months',
    value: result.working_capital_adjusted_runway_months,
    currency: null,
    periodStart: null,
    periodEnd: null,
    asOfDate: context.reportingDate,
    provenance: {
      ...context.source,
      sourceLabel: `${context.source.sourceLabel} (working-capital-adjusted runway calculated)`,
      evidence: {
        ...context.source.evidence,
        excerpt: result.calculation_breakdown.workingCapitalAdjustedFormula,
      },
    },
    confidence: context.confidence,
    updatedAt: context.updatedAt,
  }
}

export function buildUnavailableRunwayMetric(
  metrics: FinancialMetricSet
): UnavailableFinancialMetricValue {
  const assessment = assessCashRunwayMetrics(metrics)

  return createUnavailableMetric({
    key: 'runway_months',
    reason: assessment.reason ?? 'not_provided',
    detail: assessment.detail ?? 'Runway is unavailable.',
  })
}

export function buildUnavailableWorkingCapitalAdjustedRunwayMetric(
  metrics: FinancialMetricSet
): UnavailableFinancialMetricValue {
  const assessment = assessWorkingCapitalRunwayMetrics(metrics)

  return createUnavailableMetric({
    key: 'runway_months',
    reason: assessment.reason ?? 'not_provided',
    detail:
      assessment.detail ??
      'Working-capital-adjusted runway is unavailable.',
  })
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
