import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'
import {
  calculateAnalysisRunway,
  calculateOperatingBalance,
  calculateReceivablesPayablesPosition,
  classifyFinancialAnalysisReadiness,
} from '@/lib/financial-analysis/calculations'
import type {
  DeterministicFinancialFacts,
  FinancialAnalysisEvidence,
  FinancialAnalysisReadiness,
  FinancialAnalysisSectionAvailability,
} from '@/lib/financial-analysis/types'
import { SUPPORTED_FINANCIAL_CURRENCIES } from '@/lib/financial-data/currency'
import { mapObservationRowToMetric } from '@/lib/financial-data/observation-mapping'
import { selectLatestFinancialMetricObservations } from '@/lib/financial-data/latest-observation'
import {
  FINANCIAL_METRIC_KEYS,
  type FinancialMetricKey,
} from '@/lib/financial-data/metric-keys'
import { summarizeMetricForecast } from '@/lib/financial-data/metric-forecast'
import { summarizeMetricHistory } from '@/lib/financial-data/metric-history'
import { getFinancialObservationSourceKey } from '@/lib/financial-data/source-key'
import type { FinancialMetricObservation } from '@/types/database'

export const FinancialAnalysisRequestSchema = z.object({
  sourceKey: z.string().trim().min(1).max(300),
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
}).strict()

export type FinancialAnalysisRequest = z.infer<
  typeof FinancialAnalysisRequestSchema
>

export interface FinancialAnalysisCollection {
  selection: {
    sourceKey: string
    sourceLabel: string
    currency: 'NZD' | 'AUD'
  }
  readiness: FinancialAnalysisReadiness
  sections: FinancialAnalysisSectionAvailability[]
  facts: DeterministicFinancialFacts
  evidence: FinancialAnalysisEvidence[]
  assumptions: string[]
  baselineFingerprint: Array<{ id: string; updatedAt: string }>
}

const HISTORY_METRIC_KEYS = [
  'cash',
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
] as const satisfies readonly FinancialMetricKey[]

function effectiveDate(row: FinancialMetricObservation) {
  return row.as_of_date ?? row.period_end ?? row.updated_at.slice(0, 10)
}

function sameReportingDate(
  rows: Array<FinancialMetricObservation | undefined>
) {
  return rows.every(Boolean) &&
    new Set(rows.map((row) => effectiveDate(row as FinancialMetricObservation))).size === 1
}

function sixMonthRows(rows: FinancialMetricObservation[]) {
  if (rows.length === 0) return []
  const latestByDate = new Map<string, FinancialMetricObservation>()

  for (const row of rows) {
    const date = effectiveDate(row)
    const existing = latestByDate.get(date)
    if (!existing || row.updated_at > existing.updated_at) {
      latestByDate.set(date, row)
    }
  }

  const ordered = [...latestByDate.values()].sort((left, right) =>
    effectiveDate(left).localeCompare(effectiveDate(right))
  )
  const latestDate = new Date(`${effectiveDate(ordered.at(-1) as FinancialMetricObservation)}T00:00:00.000Z`)
  const cutoff = new Date(latestDate)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6)

  return ordered
    .filter((row) => new Date(`${effectiveDate(row)}T00:00:00.000Z`) >= cutoff)
    .slice(-12)
}

function finiteOrNull(value: number | null) {
  return value !== null && Number.isFinite(value) ? value : null
}

function buildHistoryFacts(rows: FinancialMetricObservation[]) {
  return HISTORY_METRIC_KEYS.flatMap((metricKey) => {
    const metricRows = sixMonthRows(
      rows.filter((row) => row.metric_key === metricKey)
    )
    if (metricRows.length === 0) return []
    const summary = summarizeMetricHistory({
      metricKey,
      range: '6m',
      recordLimit: 12,
      observations: metricRows.map(mapObservationRowToMetric),
    })

    return [{
      metricKey,
      direction: summary.direction,
      observationCount: summary.points.length,
      firstValue: summary.firstValue,
      latestValue: summary.latestValue,
      absoluteChange: summary.totalChange,
      percentageChange: finiteOrNull(summary.percentageChange),
      values: summary.points.map((point) => ({
        date: point.date,
        value: point.value,
      })),
    }]
  })
}

function buildForecastFacts(rows: FinancialMetricObservation[]) {
  return HISTORY_METRIC_KEYS.flatMap((metricKey) => {
    const metricRows = sixMonthRows(
      rows.filter((row) => row.metric_key === metricKey)
    )
    const forecast = summarizeMetricForecast({
      metricKey,
      range: '6m',
      horizon: 6,
      recordLimit: 12,
      observations: metricRows.map(mapObservationRowToMetric),
    })
    if (forecast.monthlySlope === null || forecast.forecastPoints.length !== 6) {
      return []
    }

    return [{
      metricKey,
      method: 'date_aware_linear_trend' as const,
      monthlySlope: forecast.monthlySlope,
      values: forecast.forecastPoints.map((point) => ({
        month: point.date.slice(0, 7),
        value: point.value,
      })),
    }]
  })
}

function collectUsedRows(rows: FinancialMetricObservation[]) {
  return FINANCIAL_METRIC_KEYS.flatMap((metricKey) =>
    sixMonthRows(rows.filter((row) => row.metric_key === metricKey))
  ).sort((left, right) =>
    left.metric_key.localeCompare(right.metric_key) ||
    effectiveDate(left).localeCompare(effectiveDate(right)) ||
    left.id.localeCompare(right.id)
  )
}

export function collectFinancialAnalysisFromObservations(params: {
  request: FinancialAnalysisRequest
  observations: FinancialMetricObservation[]
}): FinancialAnalysisCollection {
  const request = FinancialAnalysisRequestSchema.parse(params.request)
  const selectedRows = params.observations.filter((row) =>
    getFinancialObservationSourceKey(row) === request.sourceKey &&
    row.currency === request.currency &&
    row.metric_key !== 'runway_months'
  )

  if (selectedRows.length === 0) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'The selected source and currency are unavailable or do not belong to this user.'
    )
  }

  const latestRows = selectLatestFinancialMetricObservations(selectedRows)
  const latest = new Map(latestRows.map((row) => [row.metric_key, row]))
  const cash = latest.get('cash')
  const receivables = latest.get('accounts_receivable')
  const payables = latest.get('accounts_payable')
  const burn = latest.get('burn_rate')
  const revenue = latest.get('monthly_revenue')
  const expenses = latest.get('monthly_expenses')
  const cashRunwayCompatible = sameReportingDate([cash, burn])
  const adjustedRunwayCompatible = sameReportingDate([
    cash,
    receivables,
    payables,
    burn,
  ])
  const operatingBalanceCompatible = sameReportingDate([revenue, expenses])
  const workingCapitalCompatible = sameReportingDate([receivables, payables])
  const runway = cashRunwayCompatible && cash && burn
    ? calculateAnalysisRunway({
        cash: cash.value,
        monthlyBurnRate: burn.value,
        accountsReceivable: adjustedRunwayCompatible ? receivables?.value : null,
        accountsPayable: adjustedRunwayCompatible ? payables?.value : null,
      })
    : null
  const operatingBalance = operatingBalanceCompatible && revenue && expenses
    ? calculateOperatingBalance({
        monthlyRevenue: revenue.value,
        monthlyExpenses: expenses.value,
      })
    : null
  const receivablesPayables = workingCapitalCompatible && receivables && payables
    ? calculateReceivablesPayablesPosition({
        accountsReceivable: receivables.value,
        accountsPayable: payables.value,
      })
    : null
  const history = buildHistoryFacts(selectedRows)
  const forecasts = buildForecastFacts(selectedRows)
  const availableMetricKeys = [
    ...new Set([
      ...latestRows.map((row) => row.metric_key),
      ...(runway ? ['runway_months' as const] : []),
    ]),
  ]
  const incompatibleSections = [
    ...(cash && burn && !cashRunwayCompatible ? ['current_runway' as const] : []),
    ...(cash && receivables && payables && burn && !adjustedRunwayCompatible
      ? ['working_capital_adjusted_runway' as const]
      : []),
    ...(revenue && expenses && !operatingBalanceCompatible
      ? ['operating_balance' as const]
      : []),
    ...(receivables && payables && !workingCapitalCompatible
      ? ['working_capital' as const]
      : []),
  ]
  const cashHistoryCount = history.find((fact) => fact.metricKey === 'cash')
    ?.observationCount ?? 0
  const readiness = classifyFinancialAnalysisReadiness({
    availableMetricKeys,
    historicalObservationCount: cashHistoryCount,
    sourceSelectionRequired: true,
    sourceSelected: true,
    currencySelectionRequired: true,
    currencySelected: true,
    incompatibleSections,
  })
  const usedRows = collectUsedRows(selectedRows)

  return {
    selection: {
      sourceKey: request.sourceKey,
      sourceLabel: selectedRows[0].source_label,
      currency: request.currency,
    },
    readiness: readiness.readiness,
    sections: readiness.sections,
    facts: {
      operatingBalance,
      receivablesPayables,
      runway,
      history,
      forecasts,
    },
    evidence: usedRows.map((row) => ({
      observationId: row.id,
      metricKey: row.metric_key,
      value: row.value,
      currency: request.currency,
      reportingDate: effectiveDate(row),
      sourceLabel: row.source_label,
    })),
    assumptions: [
      'Only reviewed observations from financial_metric_observations were used.',
      `The analysis keeps ${request.currency} separate and performs no currency conversion.`,
      'History uses the selected source and currency over a fixed six-month view with at most 12 observations per metric.',
      'Forecasts continue the observed date-aware linear trend for six months and are not guarantees.',
      'Operating balance is monthly revenue minus monthly expenses and is not presented as profit.',
      'Working-capital-adjusted runway assumes receivables are collected and payables are paid.',
    ],
    baselineFingerprint: usedRows.map((row) => ({
      id: row.id,
      updatedAt: row.updated_at,
    })),
  }
}

export async function collectFinancialAnalysis(params: {
  userId: string
  request: FinancialAnalysisRequest
}) {
  const { listFinancialMetricObservations } = await import(
    '@/lib/financial-data/persistence'
  )
  const observations = await listFinancialMetricObservations(params.userId)
  return collectFinancialAnalysisFromObservations({
    request: params.request,
    observations,
  })
}
