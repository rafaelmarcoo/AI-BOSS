import { mapObservationRowToMetric } from '@/lib/financial-data/observation-mapping'
import { selectLatestFinancialMetricObservations } from '@/lib/financial-data/latest-observation'
import { listFinancialMetricObservations } from '@/lib/financial-data/persistence'
import { isSupportedFinancialCurrency } from '@/lib/financial-data/currency'
import { summarizeMetricForecast } from '@/lib/financial-data/metric-forecast'
import { getFinancialObservationSourceKey } from '@/lib/financial-data/source-key'
import { calculateScenarioAnalysis } from '@/lib/scenarios/calculation'
import type {
  ScenarioBaselineInputs,
  ScenarioMetricInput,
  ScenarioAnalysisResult,
} from '@/lib/scenarios/calculation'
import {
  getScenarioBaselineReference,
  ScenarioAnalysisInputSchema,
  type ManualScenarioBaseline,
  type ScenarioAnalysisInput,
} from '@/lib/scenarios/schema'
import { getFinancialAnalysisRun } from '@/lib/financial-analysis/persistence'
import { buildScenarioBaselineInputsFromAnalysisRun } from '@/lib/scenarios/analysis-run-baseline'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { FinancialMetricObservation } from '@/types/database'

const BASELINE_METRIC_KEYS = [
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'burn_rate',
  'monthly_revenue',
  'monthly_expenses',
] as const satisfies readonly FinancialMetricKey[]

export function isScenarioBaselineMetricKey(metricKey: FinancialMetricKey) {
  return BASELINE_METRIC_KEYS.includes(
    metricKey as typeof BASELINE_METRIC_KEYS[number]
  )
}

export interface ScenarioBaselineOption {
  sourceKey: string
  sourceLabel: string
  sourceType: FinancialMetricObservation['source_type']
  currency: 'NZD' | 'AUD'
  availableMetrics: FinancialMetricKey[]
  latestReportingDate: string | null
  cashObservationCount: number
  metrics: Partial<Record<FinancialMetricKey, {
    value: number
    reportingDate: string
    confidence: number
  }>>
}

function effectiveDate(row: FinancialMetricObservation) {
  return row.as_of_date ?? row.period_end ?? row.updated_at.slice(0, 10)
}

export function getScenarioSourceKey(row: FinancialMetricObservation) {
  return getFinancialObservationSourceKey(row)
}

function sourceCurrencyKey(row: FinancialMetricObservation) {
  return `${getScenarioSourceKey(row)}:${row.currency}`
}

export async function listScenarioBaselineOptions(userId: string) {
  const observations = await listFinancialMetricObservations(userId)
  const grouped = new Map<string, FinancialMetricObservation[]>()

  for (const row of observations) {
    if (!isSupportedFinancialCurrency(row.currency)) continue
    const key = sourceCurrencyKey(row)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  return [...grouped.values()]
    .map((rows): ScenarioBaselineOption => {
      const first = rows[0]
      const dates = rows.map(effectiveDate).sort()
      const latest = selectLatestFinancialMetricObservations(rows)
      return {
        sourceKey: getScenarioSourceKey(first),
        sourceLabel: first.source_label,
        sourceType: first.source_type,
        currency: first.currency as 'NZD' | 'AUD',
        availableMetrics: [
          ...new Set(rows.map((row) => row.metric_key)),
        ].sort() as FinancialMetricKey[],
        latestReportingDate: dates.at(-1) ?? null,
        cashObservationCount: rows.filter((row) => row.metric_key === 'cash').length,
        metrics: Object.fromEntries(latest.map((row) => [
          row.metric_key,
          { value: row.value, reportingDate: effectiveDate(row), confidence: row.confidence },
        ])),
      }
    })
    .sort((left, right) =>
      left.sourceLabel.localeCompare(right.sourceLabel) ||
      left.currency.localeCompare(right.currency)
    )
}

function metricInputFromRow(row: FinancialMetricObservation): ScenarioMetricInput {
  return {
    value: row.value,
    sourceLabel: row.source_label,
    reportingDate: effectiveDate(row),
    confidence: row.confidence,
    origin: 'verified',
    observationId: row.id,
  }
}

function manualMetric(params: {
  value: number | undefined
  original: ScenarioMetricInput | null
  sourceLabel: string
  asOfMonth?: string
  fallbackReportingDate?: string
}) {
  if (params.value === undefined) return params.original
  const matchesStoredObservation = params.original &&
    params.value === params.original.value &&
    (!params.asOfMonth || params.asOfMonth === params.original.reportingDate.slice(0, 7))

  // The model may repeat source values in the optional override object. An
  // identical value/date is not an override and must retain verified evidence.
  if (matchesStoredObservation) return params.original

  const reportingDate = params.asOfMonth
    ? `${params.asOfMonth}-01`
    : params.original?.reportingDate ?? params.fallbackReportingDate ?? null
  if (!reportingDate) {
    throw new Error('A baseline reporting month is required when a value is supplied manually.')
  }
  return {
    value: params.value,
    sourceLabel: `${params.sourceLabel} (manual assumption)`,
    reportingDate,
    confidence: null,
    origin: 'manual' as const,
    observationId: null,
  }
}

function applyManualValues(params: {
  baseline: ScenarioBaselineInputs
  manual: ManualScenarioBaseline
}) : ScenarioBaselineInputs {
  const { baseline, manual } = params
  const fallbackReportingDate = baseline.cash?.reportingDate
  return {
    ...baseline,
    cash: manualMetric({
      value: manual.cash,
      original: baseline.cash,
      sourceLabel: baseline.sourceLabel,
      asOfMonth: manual.asOfMonth,
    }),
    accountsReceivable: manualMetric({
      value: manual.accountsReceivable,
      original: baseline.accountsReceivable,
      sourceLabel: baseline.sourceLabel,
      asOfMonth: manual.asOfMonth,
      fallbackReportingDate,
    }),
    accountsPayable: manualMetric({
      value: manual.accountsPayable,
      original: baseline.accountsPayable,
      sourceLabel: baseline.sourceLabel,
      asOfMonth: manual.asOfMonth,
      fallbackReportingDate,
    }),
    burnRate: manualMetric({
      value: manual.burnRate,
      original: baseline.burnRate,
      sourceLabel: baseline.sourceLabel,
      asOfMonth: manual.asOfMonth,
      fallbackReportingDate,
    }),
    monthlyRevenue: manualMetric({
      value: manual.monthlyRevenue,
      original: baseline.monthlyRevenue,
      sourceLabel: baseline.sourceLabel,
      asOfMonth: manual.asOfMonth,
      fallbackReportingDate,
    }),
    monthlyExpenses: manualMetric({
      value: manual.monthlyExpenses,
      original: baseline.monthlyExpenses,
      sourceLabel: baseline.sourceLabel,
      asOfMonth: manual.asOfMonth,
      fallbackReportingDate,
    }),
  }
}

function buildSourceBaseline(params: {
  rows: FinancialMetricObservation[]
  sourceKey: string
  sourceLabel: string
  currency: 'NZD' | 'AUD'
  trendRange: ScenarioAnalysisInput['trendRange']
}) : ScenarioBaselineInputs {
  const { rows, sourceLabel, trendRange } = params
  const latestRows = selectLatestFinancialMetricObservations(rows)
  const latestByMetric = new Map(
    latestRows.map((row) => [row.metric_key, metricInputFromRow(row)])
  )
  const cashHistory = rows
    .filter((row) => row.metric_key === 'cash')
    .map(mapObservationRowToMetric)
  const forecast = summarizeMetricForecast({
    metricKey: 'cash',
    range: trendRange,
    horizon: 3,
    observations: cashHistory,
    recordLimit: 'all',
  })

  return {
    sourceKey: params.sourceKey,
    sourceLabel,
    currency: params.currency,
    cash: latestByMetric.get('cash') ?? null,
    accountsReceivable: latestByMetric.get('accounts_receivable') ?? null,
    accountsPayable: latestByMetric.get('accounts_payable') ?? null,
    burnRate: latestByMetric.get('burn_rate') ?? null,
    monthlyRevenue: latestByMetric.get('monthly_revenue') ?? null,
    monthlyExpenses: latestByMetric.get('monthly_expenses') ?? null,
    historicalMonthlyCashSlope: forecast.monthlySlope,
    historicalObservationCount: forecast.history.points.length,
    historicalSourceLabels: forecast.history.sourceLabels,
    historicalHasRecordedDateFallback: forecast.history.hasRecordedDateFallback,
    observationFingerprint: rows
      .filter((row) => isScenarioBaselineMetricKey(row.metric_key))
      .map((row) => ({ id: row.id, updatedAt: row.updated_at }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  }
}

export async function analyseScenario(
  userId: string,
  rawInput: unknown
): Promise<ScenarioAnalysisResult> {
  const input = ScenarioAnalysisInputSchema.parse(rawInput)
  const baselineReference = getScenarioBaselineReference(input)
  let baseline: ScenarioBaselineInputs

  if (baselineReference.kind === 'analysis_run') {
    const report = await getFinancialAnalysisRun(
      baselineReference.analysisRunId,
      userId
    )
    if (report.result.selectedBaseline.currency !== input.currency) {
      throw new Error('The scenario currency must match the frozen financial analysis report.')
    }
    baseline = buildScenarioBaselineInputsFromAnalysisRun(report)
  } else {
    const observations = await listFinancialMetricObservations(userId)
    const selected = observations.filter(
      (row) =>
        getScenarioSourceKey(row) === baselineReference.sourceKey &&
        row.currency === input.currency
    )

    if (selected.length === 0) {
      throw new Error('The selected source and currency are unavailable or do not belong to this user.')
    }

    baseline = buildSourceBaseline({
      rows: selected,
      sourceKey: baselineReference.sourceKey,
      sourceLabel: selected[0].source_label,
      currency: input.currency,
      trendRange: input.trendRange,
    })
  }

  const inputs = applyManualValues({
    baseline,
    manual: input.manualBaseline,
  })

  return calculateScenarioAnalysis({ input, baselineInputs: inputs })
}
