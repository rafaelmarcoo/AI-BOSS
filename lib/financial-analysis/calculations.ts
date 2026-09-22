import { z } from 'zod'
import { calculateRunway } from '@/lib/calculations/runway'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type {
  FinancialAnalysisReadiness,
  FinancialAnalysisSectionAvailability,
  OperatingBalanceFact,
  ReceivablesPayablesFact,
  RunwayFacts,
} from '@/lib/financial-analysis/types'

const MoneyPairSchema = z.object({
  first: z.number().finite().nonnegative(),
  second: z.number().finite().nonnegative(),
}).strict()

const AnalysisRunwayInputSchema = z.object({
  cash: z.number().finite().nonnegative(),
  monthlyBurnRate: z.number().finite().positive(),
  accountsReceivable: z.number().finite().nonnegative().nullable().optional(),
  accountsPayable: z.number().finite().nonnegative().nullable().optional(),
}).strict().superRefine((input, context) => {
  const hasReceivables = input.accountsReceivable != null
  const hasPayables = input.accountsPayable != null
  if (hasReceivables !== hasPayables) {
    context.addIssue({
      code: 'custom',
      message: 'Accounts receivable and payable must be supplied together.',
    })
  }
})

export const FinancialAnalysisReadinessInputSchema = z.object({
  availableMetricKeys: z.array(z.enum(FINANCIAL_METRIC_KEYS)),
  historicalObservationCount: z.number().int().min(0).max(12),
  sourceSelectionRequired: z.boolean(),
  sourceSelected: z.boolean(),
  currencySelectionRequired: z.boolean(),
  currencySelected: z.boolean(),
  incompatibleSections: z.array(z.enum([
    'current_runway',
    'working_capital_adjusted_runway',
    'operating_balance',
    'working_capital',
  ])).optional(),
}).strict().superRefine((input, context) => {
  if (new Set(input.availableMetricKeys).size !== input.availableMetricKeys.length) {
    context.addIssue({
      code: 'custom',
      path: ['availableMetricKeys'],
      message: 'Available metric keys must be unique.',
    })
  }
})

export type FinancialAnalysisReadinessInput = z.infer<
  typeof FinancialAnalysisReadinessInputSchema
>

const FULL_BASELINE_KEYS = [
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
] as const satisfies readonly FinancialMetricKey[]

const CORE_RUNWAY_KEYS = ['cash', 'burn_rate'] as const satisfies readonly FinancialMetricKey[]

function round(value: number) {
  return Number(value.toFixed(2))
}

export function calculateOperatingBalance(input: {
  monthlyRevenue: number
  monthlyExpenses: number
}): OperatingBalanceFact {
  const { first: monthlyRevenue, second: monthlyExpenses } = MoneyPairSchema.parse({
    first: input.monthlyRevenue,
    second: input.monthlyExpenses,
  })
  const operatingBalance = round(monthlyRevenue - monthlyExpenses)

  return {
    monthlyRevenue,
    monthlyExpenses,
    operatingBalance,
    position: operatingBalance > 0
      ? 'positive'
      : operatingBalance < 0
        ? 'negative'
        : 'balanced',
    formula: `${monthlyRevenue} - ${monthlyExpenses} = ${operatingBalance}`,
  }
}

export function calculateReceivablesPayablesPosition(input: {
  accountsReceivable: number
  accountsPayable: number
}): ReceivablesPayablesFact {
  const { first: accountsReceivable, second: accountsPayable } = MoneyPairSchema.parse({
    first: input.accountsReceivable,
    second: input.accountsPayable,
  })
  const netPosition = round(accountsReceivable - accountsPayable)

  return {
    accountsReceivable,
    accountsPayable,
    netPosition,
    position: netPosition > 0
      ? 'net_receivable'
      : netPosition < 0
        ? 'net_payable'
        : 'balanced',
    formula: `${accountsReceivable} - ${accountsPayable} = ${netPosition}`,
  }
}

export function calculateAnalysisRunway(input: {
  cash: number
  monthlyBurnRate: number
  accountsReceivable?: number | null
  accountsPayable?: number | null
}): RunwayFacts {
  const parsed = AnalysisRunwayInputSchema.parse(input)
  const result = calculateRunway({
    cash: parsed.cash,
    ar: parsed.accountsReceivable ?? 0,
    ap: parsed.accountsPayable ?? 0,
    burn: parsed.monthlyBurnRate,
  })
  const hasWorkingCapitalInputs =
    parsed.accountsReceivable != null && parsed.accountsPayable != null

  return {
    cash: parsed.cash,
    monthlyBurnRate: parsed.monthlyBurnRate,
    cashRunwayMonths: result.cash_runway_months,
    cashRunwayFormula: result.calculation_breakdown.formula,
    accountsReceivable: parsed.accountsReceivable ?? null,
    accountsPayable: parsed.accountsPayable ?? null,
    workingCapitalAdjustedRunwayMonths: hasWorkingCapitalInputs
      ? result.working_capital_adjusted_runway_months
      : null,
    workingCapitalAdjustedRunwayFormula: hasWorkingCapitalInputs
      ? result.calculation_breakdown.workingCapitalAdjustedFormula
      : null,
  }
}

function section(
  sectionId: FinancialAnalysisSectionAvailability['sectionId'],
  status: FinancialAnalysisSectionAvailability['status'],
  reason: string | null = null
): FinancialAnalysisSectionAvailability {
  return { sectionId, status, reason }
}

export function classifyFinancialAnalysisReadiness(
  input: FinancialAnalysisReadinessInput
): {
  readiness: FinancialAnalysisReadiness
  sections: FinancialAnalysisSectionAvailability[]
} {
  const parsed = FinancialAnalysisReadinessInputSchema.parse(input)
  const incompatibleSections = new Set(parsed.incompatibleSections ?? [])
  const available = new Set(parsed.availableMetricKeys)
  const missingMetricKeys = FINANCIAL_METRIC_KEYS.filter(
    (metricKey) => !available.has(metricKey)
  )
  const missingBaselineKeys = FULL_BASELINE_KEYS.filter(
    (metricKey) => !available.has(metricKey)
  )
  const missingCoreRunwayKeys = CORE_RUNWAY_KEYS.filter(
    (metricKey) => !available.has(metricKey)
  )
  const sourceSelectionMissing =
    parsed.sourceSelectionRequired && !parsed.sourceSelected
  const currencySelectionMissing =
    parsed.currencySelectionRequired && !parsed.currencySelected
  const reasons: string[] = []

  if (sourceSelectionMissing) {
    reasons.push('Select one financial source before running the analysis.')
  }
  if (currencySelectionMissing) {
    reasons.push('Select either NZD or AUD before running the analysis.')
  }
  if (missingCoreRunwayKeys.length > 0) {
    reasons.push(
      `Cash runway requires ${missingCoreRunwayKeys.join(' and ').replaceAll('_', ' ')}.`
    )
  }
  if (missingBaselineKeys.length > 0) {
    reasons.push(
      `The full baseline is missing ${missingBaselineKeys.map((key) => key.replaceAll('_', ' ')).join(', ')}.`
    )
  }
  if (parsed.historicalObservationCount < 2) {
    reasons.push('At least two comparable observations are required for a trend forecast.')
  }
  if (incompatibleSections.has('current_runway')) {
    reasons.push('Cash and monthly burn must share one reporting date for runway calculation.')
  }
  if (incompatibleSections.has('operating_balance')) {
    reasons.push('Monthly revenue and expenses must share one reporting date for operating balance.')
  }
  if (incompatibleSections.has('working_capital')) {
    reasons.push('Accounts receivable and payable must share one reporting date for the working-capital proxy.')
  }
  if (incompatibleSections.has('working_capital_adjusted_runway')) {
    reasons.push('Cash, receivables, payables, and monthly burn must share one reporting date for adjusted runway.')
  }

  const status = sourceSelectionMissing || currencySelectionMissing || missingCoreRunwayKeys.length > 0 || incompatibleSections.has('current_runway')
    ? 'action_required'
    : missingBaselineKeys.length > 0 || parsed.historicalObservationCount < 2
      ? 'limited'
      : 'ready'

  const hasRunway = missingCoreRunwayKeys.length === 0
  const hasOperatingBalance =
    available.has('monthly_revenue') && available.has('monthly_expenses')
  const hasWorkingCapital =
    available.has('accounts_receivable') && available.has('accounts_payable')
  const hasAdjustedRunwayInputs = hasRunway && hasWorkingCapital
  const selectionBlocked = sourceSelectionMissing || currencySelectionMissing
  const summaryStatus = selectionBlocked
    ? 'unavailable'
    : status === 'ready'
      ? 'available'
      : 'limited'

  return {
    readiness: {
      status,
      availableMetricKeys: [...parsed.availableMetricKeys],
      missingMetricKeys,
      historicalObservationCount: parsed.historicalObservationCount,
      reasons,
    },
    sections: [
      section(
        'executive_summary',
        summaryStatus,
        selectionBlocked ? 'A source and currency selection is required.' : status === 'limited' ? 'The summary will identify material data limitations.' : null
      ),
      section('readiness_and_limitations', 'available'),
      section(
        'current_runway',
        selectionBlocked || !hasRunway || incompatibleSections.has('current_runway')
          ? 'unavailable'
          : !hasAdjustedRunwayInputs || incompatibleSections.has('working_capital_adjusted_runway')
            ? 'limited'
            : 'available',
        !hasRunway ? 'Cash and monthly burn rate are required.' : incompatibleSections.has('current_runway') ? 'Cash and monthly burn must share one reporting date.' : selectionBlocked ? 'A source and currency selection is required.' : !hasAdjustedRunwayInputs ? 'Receivables and payables are required for the adjusted runway view.' : incompatibleSections.has('working_capital_adjusted_runway') ? 'All adjusted-runway inputs must share one reporting date.' : null
      ),
      section(
        'operating_balance',
        selectionBlocked || !hasOperatingBalance || incompatibleSections.has('operating_balance') ? 'unavailable' : 'available',
        !hasOperatingBalance ? 'Monthly revenue and expenses are required.' : incompatibleSections.has('operating_balance') ? 'Monthly revenue and expenses must share one reporting date.' : selectionBlocked ? 'A source and currency selection is required.' : null
      ),
      section(
        'working_capital',
        selectionBlocked || !hasWorkingCapital || incompatibleSections.has('working_capital') ? 'unavailable' : 'available',
        !hasWorkingCapital ? 'Accounts receivable and payable are required.' : incompatibleSections.has('working_capital') ? 'Accounts receivable and payable must share one reporting date.' : selectionBlocked ? 'A source and currency selection is required.' : null
      ),
      section(
        'history',
        selectionBlocked || parsed.historicalObservationCount === 0
          ? 'unavailable'
          : parsed.historicalObservationCount === 1
            ? 'limited'
            : 'available',
        parsed.historicalObservationCount < 2 ? 'Fewer than two comparable observations are available.' : selectionBlocked ? 'A source and currency selection is required.' : null
      ),
      section(
        'forecast',
        selectionBlocked || parsed.historicalObservationCount < 2
          ? 'unavailable'
          : 'available',
        parsed.historicalObservationCount < 2 ? 'At least two comparable observations are required.' : selectionBlocked ? 'A source and currency selection is required.' : null
      ),
      section(
        'risks_and_policies',
        selectionBlocked || !hasRunway ? 'limited' : 'available',
        selectionBlocked || !hasRunway ? 'Runway policy coverage is limited until the baseline is complete.' : null
      ),
      section('recommendations', status === 'ready' ? 'available' : 'limited', status === 'ready' ? null : 'Recommendations will prioritize resolving data limitations.'),
      section('evidence_and_trace', 'available'),
    ],
  }
}
