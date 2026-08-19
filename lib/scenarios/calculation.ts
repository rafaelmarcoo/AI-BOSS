import type { SupportedFinancialCurrency } from '@/lib/financial-data/currency'
import type {
  ScenarioAdjustment,
  ScenarioAnalysisInput,
  ScenarioPercentageMetric,
} from '@/lib/scenarios/schema'
import { ScenarioAnalysisInputSchema } from '@/lib/scenarios/schema'

export interface ScenarioMetricInput {
  value: number
  sourceLabel: string
  reportingDate: string
  confidence: number | null
  origin: 'verified' | 'manual'
  observationId: string | null
}

export interface ScenarioBaselineInputs {
  sourceKey: string
  sourceLabel: string
  currency: SupportedFinancialCurrency
  cash: ScenarioMetricInput | null
  accountsReceivable: ScenarioMetricInput | null
  accountsPayable: ScenarioMetricInput | null
  burnRate: ScenarioMetricInput | null
  monthlyRevenue: ScenarioMetricInput | null
  monthlyExpenses: ScenarioMetricInput | null
  historicalMonthlyCashSlope: number | null
  historicalObservationCount: number
  historicalSourceLabels: string[]
  historicalHasRecordedDateFallback: boolean
  observationFingerprint: Array<{ id: string; updatedAt: string }>
}

export interface ScenarioSeriesPoint {
  month: string
  value: number
  netMovement: number
}

export interface ScenarioSeriesSummary {
  endingLiquidity: number
  changeFromBaseline: number
  lowestLiquidity: number
  averageMonthlyNetMovement: number
  cashOutMonth: string | null
}

export interface ScenarioProjectionSeries {
  id: string
  label: string
  kind: 'baseline' | 'scenario'
  points: ScenarioSeriesPoint[]
  summary: ScenarioSeriesSummary
  resolvedAdjustments: Array<{
    id: string
    label: string
    description: string
    monthlyEffects: Array<{ month: string; value: number }>
  }>
}

export interface ScenarioBaselinePanel {
  method: 'current_run_rate' | 'historical_trend'
  label: string
  available: boolean
  unavailableReason: string | null
  baselineMonthlyMovement: number | null
  series: ScenarioProjectionSeries[]
}

export interface ScenarioAnalysisResult {
  input: ScenarioAnalysisInput
  currency: SupportedFinancialCurrency
  sourceKey: string
  sourceLabel: string
  projectionStartMonth: string
  openingLiquidity: number
  openingBridge: {
    cash: number
    accountsReceivable: number
    accountsPayable: number
    formula: string
  }
  panels: ScenarioBaselinePanel[]
  assumptions: string[]
  warnings: string[]
  metricInputs: ScenarioBaselineInputs
  calculatedAt: string
}

export function isScenarioAnalysisResult(value: unknown): value is ScenarioAnalysisResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ScenarioAnalysisResult>
  return (
    ScenarioAnalysisInputSchema.safeParse(candidate.input).success &&
    (candidate.currency === 'NZD' || candidate.currency === 'AUD') &&
    typeof candidate.sourceKey === 'string' &&
    typeof candidate.sourceLabel === 'string' &&
    typeof candidate.projectionStartMonth === 'string' &&
    typeof candidate.openingLiquidity === 'number' &&
    Array.isArray(candidate.panels) &&
    candidate.panels.every((panel) =>
      panel &&
      (panel.method === 'current_run_rate' || panel.method === 'historical_trend') &&
      typeof panel.available === 'boolean' &&
      Array.isArray(panel.series)
    )
  )
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function parseMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return { year, month: monthNumber }
}

export function addScenarioMonths(month: string, amount: number) {
  const parsed = parseMonth(month)
  const total = parsed.year * 12 + parsed.month - 1 + amount
  const year = Math.floor(total / 12)
  const monthNumber = (total % 12) + 1
  return `${year}-${String(monthNumber).padStart(2, '0')}`
}

export function monthAfterDate(date: string) {
  return addScenarioMonths(date.slice(0, 7), 1)
}

function monthIndex(months: string[], month: string) {
  return months.indexOf(month)
}

function percentageBasis(
  metric: ScenarioPercentageMetric,
  inputs: ScenarioBaselineInputs
) {
  if (metric === 'monthly_revenue') return inputs.monthlyRevenue?.value ?? null
  if (metric === 'monthly_expenses') return inputs.monthlyExpenses?.value ?? null
  return inputs.burnRate?.value ?? null
}

function percentageCashDirection(metric: ScenarioPercentageMetric) {
  return metric === 'monthly_revenue' ? 1 : -1
}

function adjustmentEffect(params: {
  adjustment: ScenarioAdjustment
  month: string
  months: string[]
  inputs: ScenarioBaselineInputs
}) {
  const { adjustment, month, months, inputs } = params
  const currentIndex = monthIndex(months, month)
  const startIndex = monthIndex(months, adjustment.startMonth)
  const endIndex = adjustment.endMonth
    ? monthIndex(months, adjustment.endMonth)
    : months.length - 1

  if (startIndex < 0 || endIndex < startIndex) return 0

  if (adjustment.kind === 'fixed') {
    const isActive = adjustment.frequency === 'one_off'
      ? currentIndex === startIndex
      : currentIndex >= startIndex && currentIndex <= endIndex
    if (!isActive) return 0
    return adjustment.flow === 'inflow' ? adjustment.amount : -adjustment.amount
  }

  if (currentIndex < startIndex) return 0

  const basis = percentageBasis(adjustment.metric, inputs)
  if (basis === null) return 0
  const rate = adjustment.percentageChange / 100
  const direction = percentageCashDirection(adjustment.metric)

  if (adjustment.mode === 'step') {
    if (currentIndex > endIndex) return 0
    return basis * rate * direction
  }

  // Compounding stops at the optional end month, then keeps the final level.
  const elapsedMonths = Math.min(currentIndex, endIndex) - startIndex + 1
  const changedValue = basis * (1 + rate) ** elapsedMonths
  return (changedValue - basis) * direction
}

function describeAdjustment(
  adjustment: ScenarioAdjustment,
  currency: SupportedFinancialCurrency
) {
  if (adjustment.kind === 'fixed') {
    return `${adjustment.frequency === 'one_off' ? 'One-off' : 'Recurring'} ${adjustment.flow}: ${currency} ${adjustment.amount.toLocaleString()} from ${adjustment.startMonth}${adjustment.endMonth ? ` to ${adjustment.endMonth}` : ''}.`
  }

  return `${adjustment.mode === 'compound' ? 'Compounding' : 'Fixed'} ${adjustment.percentageChange}% change to ${adjustment.metric.replaceAll('_', ' ')} from ${adjustment.startMonth}${adjustment.endMonth ? ` to ${adjustment.endMonth}` : ''}.`
}

function summarizeSeries(
  openingLiquidity: number,
  points: ScenarioSeriesPoint[],
  baselinePoints?: ScenarioSeriesPoint[]
): ScenarioSeriesSummary {
  const endingLiquidity = points.at(-1)?.value ?? openingLiquidity
  const baselineEnding = baselinePoints?.at(-1)?.value ?? endingLiquidity
  return {
    endingLiquidity: round(endingLiquidity),
    changeFromBaseline: round(endingLiquidity - baselineEnding),
    lowestLiquidity: round(Math.min(openingLiquidity, ...points.map((point) => point.value))),
    averageMonthlyNetMovement: round((endingLiquidity - openingLiquidity) / Math.max(1, points.length)),
    cashOutMonth: points.find((point) => point.value <= 0)?.month ?? null,
  }
}

function buildPanel(params: {
  method: ScenarioBaselinePanel['method']
  label: string
  baselineMonthlyMovement: number | null
  unavailableReason: string | null
  input: ScenarioAnalysisInput
  inputs: ScenarioBaselineInputs
  openingLiquidity: number
  months: string[]
}) : ScenarioBaselinePanel {
  const {
    method,
    label,
    baselineMonthlyMovement,
    unavailableReason,
    input,
    inputs,
    openingLiquidity,
    months,
  } = params

  if (baselineMonthlyMovement === null) {
    return {
      method,
      label,
      available: false,
      unavailableReason,
      baselineMonthlyMovement: null,
      series: [],
    }
  }

  let baselineBalance = openingLiquidity
  const baselinePoints = months.map((month) => {
    baselineBalance = round(baselineBalance + baselineMonthlyMovement)
    return { month, value: baselineBalance, netMovement: round(baselineMonthlyMovement) }
  })
  const baselineSeries: ScenarioProjectionSeries = {
    id: 'baseline',
    label: 'Baseline',
    kind: 'baseline',
    points: baselinePoints,
    summary: summarizeSeries(openingLiquidity, baselinePoints),
    resolvedAdjustments: [],
  }

  const scenarioSeries = input.scenarios.map((scenario) => {
    let balance = openingLiquidity
    const resolvedEffects = new Map(
      scenario.adjustments.map((adjustment) => [
        adjustment.id,
        months.map((month) => ({
          month,
          value: round(adjustmentEffect({ adjustment, month, months, inputs })),
        })),
      ])
    )
    const points = months.map((month, index) => {
      const adjustmentMovement = scenario.adjustments.reduce(
        (total, adjustment) => total + (resolvedEffects.get(adjustment.id)?.[index]?.value ?? 0),
        0
      )
      const netMovement = round(baselineMonthlyMovement + adjustmentMovement)
      balance = round(balance + netMovement)
      return { month, value: balance, netMovement }
    })

    return {
      id: scenario.id,
      label: scenario.label,
      kind: 'scenario' as const,
      points,
      summary: summarizeSeries(openingLiquidity, points, baselinePoints),
      resolvedAdjustments: scenario.adjustments.map((adjustment) => ({
        id: adjustment.id,
        label: adjustment.label,
        description: describeAdjustment(adjustment, input.currency),
        monthlyEffects: resolvedEffects.get(adjustment.id) ?? [],
      })),
    }
  })

  return {
    method,
    label,
    available: true,
    unavailableReason: null,
    baselineMonthlyMovement: round(baselineMonthlyMovement),
    series: [baselineSeries, ...scenarioSeries],
  }
}

function validateAnalysisMonths(input: ScenarioAnalysisInput, months: string[]) {
  for (const scenario of input.scenarios) {
    for (const adjustment of scenario.adjustments) {
      if (!months.includes(adjustment.startMonth)) {
        throw new Error(`The start month for "${adjustment.label}" is outside the selected horizon.`)
      }
      if (adjustment.endMonth && !months.includes(adjustment.endMonth)) {
        throw new Error(`The end month for "${adjustment.label}" is outside the selected horizon.`)
      }
      if (adjustment.endMonth && adjustment.endMonth < adjustment.startMonth) {
        throw new Error(`The end month for "${adjustment.label}" must not be before its start month.`)
      }
    }
  }
}

function missingPercentageMetrics(
  input: ScenarioAnalysisInput,
  inputs: ScenarioBaselineInputs
) {
  return [
    ...new Set(
      input.scenarios.flatMap((scenario) =>
        scenario.adjustments.flatMap((adjustment) =>
          adjustment.kind === 'percentage' &&
          percentageBasis(adjustment.metric, inputs) === null
            ? [adjustment.metric]
            : []
        )
      )
    ),
  ]
}

export function calculateScenarioAnalysis(params: {
  input: ScenarioAnalysisInput
  baselineInputs: ScenarioBaselineInputs
  now?: string
}): ScenarioAnalysisResult {
  const { input, baselineInputs } = params
  const cash = baselineInputs.cash?.value
  const ar = baselineInputs.accountsReceivable?.value
  const ap = baselineInputs.accountsPayable?.value

  if (cash === undefined || ar === undefined || ap === undefined) {
    throw new Error('Cash, accounts receivable, and accounts payable are required to calculate opening available liquidity.')
  }

  const missingMetrics = missingPercentageMetrics(input, baselineInputs)
  if (missingMetrics.length > 0) {
    throw new Error(`Missing verified or manual percentage basis: ${missingMetrics.join(', ')}.`)
  }

  const reportingDate = baselineInputs.cash?.reportingDate
  if (!reportingDate) {
    throw new Error('A reporting month is required for the opening cash value.')
  }

  const projectionStartMonth = monthAfterDate(reportingDate)
  const months = Array.from({ length: input.horizon }, (_, index) =>
    addScenarioMonths(projectionStartMonth, index)
  )
  validateAnalysisMonths(input, months)

  const openingLiquidity = round(cash + ar - ap)
  const currentMovement = baselineInputs.burnRate
    ? -baselineInputs.burnRate.value
    : null
  const historicalMovement = baselineInputs.historicalMonthlyCashSlope
  const uniqueDates = new Set(
    [
      baselineInputs.cash,
      baselineInputs.accountsReceivable,
      baselineInputs.accountsPayable,
      baselineInputs.burnRate,
      baselineInputs.monthlyRevenue,
      baselineInputs.monthlyExpenses,
    ].flatMap((metric) => metric ? [metric.reportingDate.slice(0, 7)] : [])
  )
  const hasManualInputs = [
    baselineInputs.cash,
    baselineInputs.accountsReceivable,
    baselineInputs.accountsPayable,
    baselineInputs.burnRate,
    baselineInputs.monthlyRevenue,
    baselineInputs.monthlyExpenses,
  ].some((metric) => metric?.origin === 'manual')

  return {
    input,
    currency: input.currency,
    sourceKey: input.sourceKey,
    sourceLabel: baselineInputs.sourceLabel,
    projectionStartMonth,
    openingLiquidity,
    openingBridge: {
      cash,
      accountsReceivable: ar,
      accountsPayable: ap,
      formula: `${cash} + ${ar} - ${ap} = ${openingLiquidity}`,
    },
    panels: [
      buildPanel({
        method: 'current_run_rate',
        label: 'Current run rate',
        baselineMonthlyMovement: currentMovement,
        unavailableReason: 'Current run rate requires a verified or manual monthly burn rate.',
        input,
        inputs: baselineInputs,
        openingLiquidity,
        months,
      }),
      buildPanel({
        method: 'historical_trend',
        label: 'Historical trend',
        baselineMonthlyMovement: historicalMovement,
        unavailableReason: 'Historical trend requires at least two comparable dated cash observations.',
        input,
        inputs: baselineInputs,
        openingLiquidity,
        months,
      }),
    ],
    assumptions: [
      'Opening available liquidity assumes all current accounts receivable is collected and all current accounts payable is paid before Month 1.',
      'Current run rate continues the selected monthly burn without an automatic growth assumption.',
      'Historical trend continues the date-aware cash slope from the selected observation range.',
      'Taxes, GST, depreciation, interest, payroll overheads, and legal consequences are excluded unless entered as explicit cash adjustments.',
    ],
    warnings: [
      ...(uniqueDates.size > 1
        ? ['Baseline metrics use different reporting months. Review each dated input before relying on the comparison.']
        : []),
      ...(hasManualInputs
        ? ['One or more baseline values are unverified manual scenario assumptions and were not written to stored financial observations.']
        : []),
      ...(input.horizon >= 12
        ? [`The ${input.horizon}-month view extends uncertainty and should be reviewed regularly as actual data changes.`]
        : []),
      ...(baselineInputs.historicalHasRecordedDateFallback
        ? ['At least one historical cash observation uses its recorded/upload date because a reporting date was unavailable.']
        : []),
    ],
    metricInputs: baselineInputs,
    calculatedAt: params.now ?? new Date().toISOString(),
  }
}
