import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { FinancialAnalysisRunView } from '@/lib/financial-analysis/persistence'
import type {
  ScenarioBaselineInputs,
  ScenarioMetricInput,
} from '@/lib/scenarios/calculation'

const SCENARIO_METRIC_KEYS = [
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'burn_rate',
  'monthly_revenue',
  'monthly_expenses',
] as const satisfies readonly FinancialMetricKey[]

type ScenarioMetricKey = typeof SCENARIO_METRIC_KEYS[number]

const INPUT_FIELD_BY_METRIC = {
  cash: 'cash',
  accounts_receivable: 'accountsReceivable',
  accounts_payable: 'accountsPayable',
  burn_rate: 'burnRate',
  monthly_revenue: 'monthlyRevenue',
  monthly_expenses: 'monthlyExpenses',
} as const satisfies Record<ScenarioMetricKey, keyof Pick<
  ScenarioBaselineInputs,
  | 'cash'
  | 'accountsReceivable'
  | 'accountsPayable'
  | 'burnRate'
  | 'monthlyRevenue'
  | 'monthlyExpenses'
>>

export interface AnalysisRunScenarioBaselineOption {
  sourceKey: string
  sourceLabel: string
  sourceType: 'analysis_run'
  analysisRunId: string
  currency: 'NZD' | 'AUD'
  availableMetrics: FinancialMetricKey[]
  latestReportingDate: string
  cashObservationCount: number
  metrics: Partial<Record<FinancialMetricKey, {
    value: number
    reportingDate: string
    confidence: number
  }>>
}

function sourceLabel(report: FinancialAnalysisRunView) {
  return `Frozen analysis through ${report.result.selectedBaseline.reportDate}`
}

function currentEvidence(
  report: FinancialAnalysisRunView,
  metricKey: ScenarioMetricKey
) {
  return report.result.evidence
    .filter((item) =>
      item.metricKey === metricKey &&
      item.reportingDate === report.result.selectedBaseline.reportDate &&
      item.usedInCalculations
    )
    .sort((left, right) =>
      Number(right.resolution === 'user_selected') -
        Number(left.resolution === 'user_selected') ||
      left.observationId.localeCompare(right.observationId)
    )[0] ?? null
}

function metricInput(
  report: FinancialAnalysisRunView,
  metricKey: ScenarioMetricKey
): ScenarioMetricInput | null {
  const evidence = currentEvidence(report, metricKey)
  if (!evidence) return null
  return {
    value: evidence.value,
    sourceLabel: evidence.sourceLabel,
    reportingDate: evidence.reportingDate,
    confidence: evidence.confidence,
    origin: 'analysis_snapshot',
    observationId: evidence.observationId,
  }
}

export function buildScenarioBaselineInputsFromAnalysisRun(
  report: FinancialAnalysisRunView
): ScenarioBaselineInputs {
  const metricInputs = Object.fromEntries(
    SCENARIO_METRIC_KEYS.map((metricKey) => [
      INPUT_FIELD_BY_METRIC[metricKey],
      metricInput(report, metricKey),
    ])
  ) as Pick<
    ScenarioBaselineInputs,
    | 'cash'
    | 'accountsReceivable'
    | 'accountsPayable'
    | 'burnRate'
    | 'monthlyRevenue'
    | 'monthlyExpenses'
  >
  const cashHistory = report.result.facts.history.find(
    (fact) => fact.metricKey === 'cash'
  )
  const cashForecast = report.result.facts.forecasts.find(
    (fact) => fact.metricKey === 'cash'
  )

  return {
    sourceKey: `analysis-run:${report.id}`,
    sourceLabel: sourceLabel(report),
    currency: report.result.selectedBaseline.currency,
    ...metricInputs,
    historicalMonthlyCashSlope: cashForecast?.monthlySlope ?? null,
    historicalObservationCount: cashHistory?.observationCount ?? 0,
    historicalSourceLabels: report.result.selectedBaseline.sources.map(
      (source) => source.sourceLabel
    ),
    historicalHasRecordedDateFallback: false,
    observationFingerprint: [{
      id: report.id,
      updatedAt: report.createdAt,
    }],
  }
}

export function buildScenarioBaselineOptionFromAnalysisRun(
  report: FinancialAnalysisRunView
): AnalysisRunScenarioBaselineOption {
  const inputs = buildScenarioBaselineInputsFromAnalysisRun(report)
  const metrics = Object.fromEntries(
    SCENARIO_METRIC_KEYS.flatMap((metricKey) => {
      const input = inputs[INPUT_FIELD_BY_METRIC[metricKey]]
      return input
        ? [[metricKey, {
            value: input.value,
            reportingDate: input.reportingDate,
            confidence: input.confidence ?? 1,
          }]]
        : []
    })
  ) as AnalysisRunScenarioBaselineOption['metrics']

  return {
    sourceKey: `analysis-run:${report.id}`,
    sourceLabel: sourceLabel(report),
    sourceType: 'analysis_run',
    analysisRunId: report.id,
    currency: inputs.currency,
    availableMetrics: SCENARIO_METRIC_KEYS.filter((metricKey) => metrics[metricKey]),
    latestReportingDate: report.result.selectedBaseline.reportDate,
    cashObservationCount: inputs.historicalObservationCount,
    metrics,
  }
}
