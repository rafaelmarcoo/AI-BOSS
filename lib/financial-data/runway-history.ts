import type { AvailableFinancialMetricValue } from '@/lib/financial-data/types'
import { calculateRunway } from '@/lib/calculations/runway'
import { isSupportedFinancialCurrency } from '@/lib/financial-data/currency'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'

export interface RunwayTrendSummary {
  observations: AvailableFinancialMetricValue[]
  direction: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  change: number | null
  averageChange: number | null
}

export type DerivedRunwayVariant =
  | 'cash'
  | 'working_capital_adjusted'

const DERIVED_RUNWAY_INPUT_KEYS = [
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'burn_rate',
] as const satisfies readonly FinancialMetricKey[]

function sourceKey(metric: AvailableFinancialMetricValue) {
  return metric.provenance.sourceId
    ? `${metric.provenance.sourceType}:${metric.provenance.sourceId}`
    : `${metric.provenance.sourceType}:label:${metric.provenance.sourceLabel}`
}

function reportingDate(metric: AvailableFinancialMetricValue) {
  return metric.asOfDate ?? metric.periodEnd
}

export function deriveRunwayHistoryObservations(params: {
  observations: AvailableFinancialMetricValue[]
  variant: DerivedRunwayVariant
}) {
  const grouped = new Map<
    string,
    Partial<Record<FinancialMetricKey, AvailableFinancialMetricValue>>
  >()

  for (const observation of params.observations) {
    const date = reportingDate(observation)
    if (!date || !isSupportedFinancialCurrency(observation.currency)) continue

    const groupKey = `${sourceKey(observation)}:${observation.currency}:${date}`
    const group = grouped.get(groupKey) ?? {}
    const existing = group[observation.key]
    if (!existing || observation.updatedAt > existing.updatedAt) {
      group[observation.key] = observation
    }
    grouped.set(groupKey, group)
  }

  const requiredKeys = params.variant === 'cash'
    ? (['cash', 'burn_rate'] as const)
    : DERIVED_RUNWAY_INPUT_KEYS

  return [...grouped.values()]
    .flatMap((group) => {
      if (requiredKeys.some((key) => !group[key])) return []

      const cash = group.cash as AvailableFinancialMetricValue
      const burn = group.burn_rate as AvailableFinancialMetricValue
      const receivables = group.accounts_receivable
      const payables = group.accounts_payable
      const input = {
        cash: cash.value,
        ar: params.variant === 'working_capital_adjusted'
          ? (receivables as AvailableFinancialMetricValue).value
          : 0,
        ap: params.variant === 'working_capital_adjusted'
          ? (payables as AvailableFinancialMetricValue).value
          : 0,
        burn: burn.value,
      }

      if (
        input.cash < 0 ||
        input.ar < 0 ||
        input.ap < 0 ||
        input.burn <= 0 ||
        !Object.values(input).every(Number.isFinite)
      ) {
        return []
      }

      const result = calculateRunway(input)
      const inputs = requiredKeys.map(
        (key) => group[key] as AvailableFinancialMetricValue
      )
      const date = reportingDate(cash) as string
      const currency = cash.currency as 'NZD' | 'AUD'
      const variantLabel = params.variant === 'cash'
        ? 'cash runway'
        : 'working-capital-adjusted runway'
      const value = params.variant === 'cash'
        ? result.cash_runway_months
        : result.working_capital_adjusted_runway_months
      const formula = params.variant === 'cash'
        ? result.calculation_breakdown.formula
        : result.calculation_breakdown.workingCapitalAdjustedFormula

      return [{
        status: 'available' as const,
        key: 'runway_months' as const,
        value,
        currency,
        periodStart: null,
        periodEnd: null,
        asOfDate: date,
        provenance: {
          ...cash.provenance,
          sourceId: cash.provenance.sourceId ?? sourceKey(cash),
          sourceLabel: `${cash.provenance.sourceLabel} — ${currency} (${variantLabel} calculated)`,
          evidence: {
            ...cash.provenance.evidence,
            excerpt: formula,
          },
        },
        confidence: Math.min(...inputs.map((metric) => metric.confidence)),
        updatedAt: inputs.map((metric) => metric.updatedAt).sort().at(-1) as string,
      } satisfies AvailableFinancialMetricValue]
    })
    .sort((left, right) =>
      (left.asOfDate as string).localeCompare(right.asOfDate as string)
    )
}

export async function readDerivedRunwayHistory(
  userId: string,
  variant: DerivedRunwayVariant
) {
  const { listFinancialMetricObservationHistory } = await import(
    '@/lib/financial-data/persistence'
  )
  const keys = variant === 'cash'
    ? (['cash', 'burn_rate'] as const)
    : DERIVED_RUNWAY_INPUT_KEYS
  const histories = await Promise.all(
    keys.map((metricKey) =>
      listFinancialMetricObservationHistory({
        userId,
        metricKey,
        limit: 'all',
      })
    )
  )

  return deriveRunwayHistoryObservations({
    observations: histories.flat(),
    variant,
  })
}

async function readAllRunwayInputHistory(userId: string) {
  const { listFinancialMetricObservationHistory } = await import(
    '@/lib/financial-data/persistence'
  )

  return (await Promise.all(
    DERIVED_RUNWAY_INPUT_KEYS.map((metricKey) =>
      listFinancialMetricObservationHistory({
        userId,
        metricKey,
        limit: 'all',
      })
    )
  )).flat()
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
  const inputObservations = await readAllRunwayInputHistory(userId)
  const cashObservations = deriveRunwayHistoryObservations({
    observations: inputObservations,
    variant: 'cash',
  })
  const workingCapitalAdjustedObservations =
    deriveRunwayHistoryObservations({
      observations: inputObservations,
      variant: 'working_capital_adjusted',
    })

  return {
    ...summarizeRunwayTrend(cashObservations.slice(-6)),
    workingCapitalAdjusted: summarizeRunwayTrend(
      workingCapitalAdjustedObservations.slice(-6)
    ),
  }
}
