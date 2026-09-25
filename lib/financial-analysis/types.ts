import { z } from 'zod'
import { SUPPORTED_FINANCIAL_CURRENCIES } from '@/lib/financial-data/currency'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'

export const FINANCIAL_ANALYSIS_RESULT_V1_VERSION = 'financial-analysis-v1' as const
export const FINANCIAL_ANALYSIS_RESULT_VERSION = 'financial-analysis-v2' as const
export const FINANCIAL_ANALYSIS_POLICY_VERSION = 'mvp-v1' as const

export const FinancialAnalysisSelectionModeSchema = z.enum([
  'single',
  'timeline',
])
export type FinancialAnalysisSelectionMode = z.infer<
  typeof FinancialAnalysisSelectionModeSchema
>

export const FinancialAnalysisRunStatusSchema = z.enum([
  'complete',
  'completed_with_fallback',
])
export type FinancialAnalysisRunStatus = z.infer<
  typeof FinancialAnalysisRunStatusSchema
>

export const FinancialAnalysisReadinessStatusSchema = z.enum([
  'ready',
  'limited',
  'action_required',
])
export type FinancialAnalysisReadinessStatus = z.infer<
  typeof FinancialAnalysisReadinessStatusSchema
>

export const FINANCIAL_ANALYSIS_SECTION_IDS = [
  'executive_summary',
  'readiness_and_limitations',
  'current_runway',
  'operating_balance',
  'working_capital',
  'history',
  'forecast',
  'risks_and_policies',
  'recommendations',
  'evidence_and_trace',
] as const

export const FinancialAnalysisSectionIdSchema = z.enum(
  FINANCIAL_ANALYSIS_SECTION_IDS
)
export type FinancialAnalysisSectionId = z.infer<
  typeof FinancialAnalysisSectionIdSchema
>

export const FinancialAnalysisSectionAvailabilityStatusSchema = z.enum([
  'available',
  'limited',
  'unavailable',
])
export type FinancialAnalysisSectionAvailabilityStatus = z.infer<
  typeof FinancialAnalysisSectionAvailabilityStatusSchema
>

export const FinancialAnalysisSectionAvailabilitySchema = z.object({
  sectionId: FinancialAnalysisSectionIdSchema,
  status: FinancialAnalysisSectionAvailabilityStatusSchema,
  reason: z.string().trim().min(1).nullable(),
}).strict()
export type FinancialAnalysisSectionAvailability = z.infer<
  typeof FinancialAnalysisSectionAvailabilitySchema
>

export const FinancialAnalysisSectionsSchema = z.array(
  FinancialAnalysisSectionAvailabilitySchema
).length(FINANCIAL_ANALYSIS_SECTION_IDS.length).superRefine((sections, context) => {
  const sectionIds = sections.map((section) => section.sectionId)
  if (new Set(sectionIds).size !== sectionIds.length) {
    context.addIssue({
      code: 'custom',
      message: 'Each financial analysis section must appear exactly once.',
    })
  }
})

export const OperatingBalanceFactSchema = z.object({
  monthlyRevenue: z.number().finite().nonnegative(),
  monthlyExpenses: z.number().finite().nonnegative(),
  operatingBalance: z.number().finite(),
  position: z.enum(['positive', 'negative', 'balanced']),
  formula: z.string().min(1),
}).strict()
export type OperatingBalanceFact = z.infer<typeof OperatingBalanceFactSchema>

export const ReceivablesPayablesFactSchema = z.object({
  accountsReceivable: z.number().finite().nonnegative(),
  accountsPayable: z.number().finite().nonnegative(),
  netPosition: z.number().finite(),
  position: z.enum(['net_receivable', 'net_payable', 'balanced']),
  formula: z.string().min(1),
}).strict()
export type ReceivablesPayablesFact = z.infer<
  typeof ReceivablesPayablesFactSchema
>

export const RunwayFactsSchema = z.object({
  cash: z.number().finite().nonnegative(),
  monthlyBurnRate: z.number().finite().positive(),
  cashRunwayMonths: z.number().finite().nonnegative(),
  cashRunwayFormula: z.string().min(1),
  accountsReceivable: z.number().finite().nonnegative().nullable(),
  accountsPayable: z.number().finite().nonnegative().nullable(),
  workingCapitalAdjustedRunwayMonths: z.number().finite().nullable(),
  workingCapitalAdjustedRunwayFormula: z.string().min(1).nullable(),
}).strict().superRefine((facts, context) => {
  const adjustedFields = [
    facts.accountsReceivable,
    facts.accountsPayable,
    facts.workingCapitalAdjustedRunwayMonths,
    facts.workingCapitalAdjustedRunwayFormula,
  ]
  const presentCount = adjustedFields.filter((value) => value !== null).length
  if (presentCount !== 0 && presentCount !== adjustedFields.length) {
    context.addIssue({
      code: 'custom',
      message: 'Working-capital-adjusted runway fields must be all present or all null.',
    })
  }
})
export type RunwayFacts = z.infer<typeof RunwayFactsSchema>

export const TrendDirectionSchema = z.enum([
  'improving',
  'worsening',
  'stable',
  'insufficient_data',
])
export type TrendDirection = z.infer<typeof TrendDirectionSchema>

export const FinancialTrendFactSchema = z.object({
  metricKey: z.enum(FINANCIAL_METRIC_KEYS),
  direction: TrendDirectionSchema,
  observationCount: z.number().int().min(0).max(12),
  firstValue: z.number().finite().nullable(),
  latestValue: z.number().finite().nullable(),
  absoluteChange: z.number().finite().nullable(),
  percentageChange: z.number().finite().nullable(),
  values: z.array(z.object({
    date: z.string().date(),
    value: z.number().finite(),
  }).strict()).max(12),
}).strict().superRefine((fact, context) => {
  if (fact.observationCount !== fact.values.length) {
    context.addIssue({
      code: 'custom',
      path: ['observationCount'],
      message: 'Observation count must match the number of historical values.',
    })
  }
})
export type FinancialTrendFact = z.infer<typeof FinancialTrendFactSchema>

export const FinancialForecastFactSchema = z.object({
  metricKey: z.enum(FINANCIAL_METRIC_KEYS),
  method: z.literal('date_aware_linear_trend'),
  monthlySlope: z.number().finite(),
  values: z.array(z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    value: z.number().finite(),
  }).strict()).length(6),
}).strict()
export type FinancialForecastFact = z.infer<typeof FinancialForecastFactSchema>

export const DeterministicFinancialFactsV1Schema = z.object({
  operatingBalance: OperatingBalanceFactSchema.nullable(),
  receivablesPayables: ReceivablesPayablesFactSchema.nullable(),
  runway: RunwayFactsSchema.nullable(),
  history: z.array(FinancialTrendFactSchema),
  forecasts: z.array(FinancialForecastFactSchema),
}).strict()

export const FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS = [
  'cash',
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
  'accounts_receivable',
  'accounts_payable',
  'cash_runway_months',
  'working_capital_adjusted_runway_months',
] as const

export const FinancialAnalysisComparisonMetricKeySchema = z.enum(
  FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS
)
export type FinancialAnalysisComparisonMetricKey = z.infer<
  typeof FinancialAnalysisComparisonMetricKeySchema
>

export const FinancialAnalysisComparisonPointSchema = z.object({
  reportingDate: z.string().date(),
  value: z.number().finite(),
}).strict()
export type FinancialAnalysisComparisonPoint = z.infer<
  typeof FinancialAnalysisComparisonPointSchema
>

export const FinancialAnalysisPeriodChangeSchema = z.object({
  absolute: z.number().finite(),
  percentage: z.number().finite().nullable(),
}).strict()
export type FinancialAnalysisPeriodChange = z.infer<
  typeof FinancialAnalysisPeriodChangeSchema
>

export const FinancialAnalysisPeriodComparisonSchema = z.object({
  metricKey: FinancialAnalysisComparisonMetricKeySchema,
  earliest: FinancialAnalysisComparisonPointSchema.nullable(),
  previous: FinancialAnalysisComparisonPointSchema.nullable(),
  latest: FinancialAnalysisComparisonPointSchema.nullable(),
  startToLatestChange: FinancialAnalysisPeriodChangeSchema.nullable(),
  previousToLatestChange: FinancialAnalysisPeriodChangeSchema.nullable(),
  unavailableReason: z.string().min(1).nullable(),
}).strict()
export type FinancialAnalysisPeriodComparison = z.infer<
  typeof FinancialAnalysisPeriodComparisonSchema
>

export const DeterministicFinancialFactsSchema = DeterministicFinancialFactsV1Schema.extend({
  periodComparisons: z.array(FinancialAnalysisPeriodComparisonSchema)
    .length(FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS.length)
    .superRefine((comparisons, context) => {
      const metricKeys = comparisons.map((comparison) => comparison.metricKey)
      if (
        new Set(metricKeys).size !== metricKeys.length ||
        FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS.some(
          (metricKey) => !metricKeys.includes(metricKey)
        )
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Period comparisons must include each supported metric exactly once.',
        })
      }
    }),
}).strict()
export type DeterministicFinancialFacts = z.infer<
  typeof DeterministicFinancialFactsSchema
>

export const FinancialAnalysisAgentStepSchema = z.enum([
  'collector',
  'financial_position_agent',
  'trend_forecast_agent',
  'policy_engine',
  'executive_synthesizer',
])
export type FinancialAnalysisAgentStep = z.infer<
  typeof FinancialAnalysisAgentStepSchema
>

export const FinancialAnalysisAgentTraceEntrySchema = z.object({
  step: FinancialAnalysisAgentStepSchema,
  execution: z.enum(['deterministic', 'model']),
  status: z.enum(['completed', 'completed_with_fallback', 'skipped']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  model: z.string().min(1).nullable(),
  inputFingerprint: z.string().min(1).nullable(),
  warnings: z.array(z.string().min(1)),
}).strict()
export type FinancialAnalysisAgentTraceEntry = z.infer<
  typeof FinancialAnalysisAgentTraceEntrySchema
>

export const FinancialAnalysisAgentTraceSchema = z.object({
  fallbackUsed: z.boolean(),
  entries: z.array(FinancialAnalysisAgentTraceEntrySchema),
}).strict()
export type FinancialAnalysisAgentTrace = z.infer<
  typeof FinancialAnalysisAgentTraceSchema
>

export const FinancialPolicyRuleIdSchema = z.enum([
  'current_runway_urgent',
  'current_runway_caution',
  'current_runway_healthy',
  'decision_adjusted_runway_minimum',
  'six_month_liquidity_positive',
])
export type FinancialPolicyRuleId = z.infer<typeof FinancialPolicyRuleIdSchema>

export const FinancialPolicyRuleEvaluationSchema = z.object({
  ruleId: FinancialPolicyRuleIdSchema,
  status: z.enum(['passed', 'triggered', 'not_applicable']),
  severity: z.enum(['info', 'warning', 'block']),
  actual: z.number().finite().nullable(),
  threshold: z.number().finite().nullable(),
  message: z.string().min(1),
}).strict()
export type FinancialPolicyRuleEvaluation = z.infer<
  typeof FinancialPolicyRuleEvaluationSchema
>

export const FinancialPolicyEvaluationSchema = z.object({
  policyVersion: z.literal(FINANCIAL_ANALYSIS_POLICY_VERSION),
  decision: z.enum(['allow', 'warn', 'block']),
  triggeredRuleIds: z.array(FinancialPolicyRuleIdSchema),
  rules: z.array(FinancialPolicyRuleEvaluationSchema),
}).strict()
export type FinancialPolicyEvaluation = z.infer<
  typeof FinancialPolicyEvaluationSchema
>

export const FinancialRecommendationIdSchema = z.enum([
  'fix_data_gaps',
  'protect_runway_now',
  'restore_operating_balance',
  'address_worsening_cash_or_burn',
  'improve_collections_and_payable_timing',
  'build_runway_buffer',
])
export type FinancialRecommendationId = z.infer<
  typeof FinancialRecommendationIdSchema
>

export const FinancialRecommendationSchema = z.object({
  id: FinancialRecommendationIdSchema,
  priority: z.number().int().min(1).max(3),
  reason: z.string().min(1),
}).strict()
export type FinancialRecommendation = z.infer<
  typeof FinancialRecommendationSchema
>

export const FinancialAnalysisNarrativeSchema = z.object({
  executiveSummary: z.string().min(1),
  financialPosition: z.string().min(1),
  trendAndForecast: z.string().min(1),
  risks: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)),
}).strict()
export type FinancialAnalysisNarrative = z.infer<
  typeof FinancialAnalysisNarrativeSchema
>

export const FinancialAnalysisEvidenceV1Schema = z.object({
  observationId: z.string().min(1),
  metricKey: z.enum(FINANCIAL_METRIC_KEYS),
  value: z.number().finite(),
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES).nullable(),
  reportingDate: z.string().date(),
  sourceLabel: z.string().min(1),
}).strict()

export const FinancialAnalysisEvidenceResolutionSchema = z.enum([
  'uncontested',
  'identical_duplicate',
  'user_selected',
  'excluded_conflict',
])
export type FinancialAnalysisEvidenceResolution = z.infer<
  typeof FinancialAnalysisEvidenceResolutionSchema
>

export const FinancialAnalysisEvidenceSchema = FinancialAnalysisEvidenceV1Schema.extend({
  sourceType: z.enum(['xero', 'myob', 'quickbooks', 'freshbooks', 'document', 'manual', 'demo']),
  sourceKey: z.string().min(1),
  documentId: z.string().min(1).nullable(),
  connectionId: z.string().min(1).nullable(),
  confidence: z.number().finite().min(0).max(1),
  usedInCalculations: z.boolean(),
  resolution: FinancialAnalysisEvidenceResolutionSchema,
}).strict()
export type FinancialAnalysisEvidence = z.infer<
  typeof FinancialAnalysisEvidenceSchema
>

export const FinancialAnalysisSelectedSourceSchema = z.object({
  sourceKey: z.string().min(1),
  sourceLabel: z.string().min(1),
  sourceType: z.enum(['xero', 'myob', 'quickbooks', 'freshbooks', 'document', 'manual', 'demo']),
  documentId: z.string().min(1).nullable(),
  connectionId: z.string().min(1).nullable(),
}).strict()
export type FinancialAnalysisSelectedSource = z.infer<
  typeof FinancialAnalysisSelectedSourceSchema
>

const MonthSchema = z.string().regex(
  /^\d{4}-(0[1-9]|1[0-2])$/,
  'Use a calendar month in YYYY-MM format.'
)

export const SixMonthLiquidityPointSchema = z.object({
  month: MonthSchema,
  value: z.number().finite(),
}).strict()
export type SixMonthLiquidityPoint = z.infer<
  typeof SixMonthLiquidityPointSchema
>

export const FinancialDecisionTestInputSchema = z.object({
  decisionLabel: z.string().trim().min(1).max(120),
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
  baselineCash: z.number().finite().nonnegative(),
  baselineBurnRate: z.number().finite().nonnegative(),
  confirmedOneOffInflows: z.number().finite().nonnegative().default(0),
  oneOffOutflows: z.number().finite().nonnegative().default(0),
  recurringInflows: z.number().finite().nonnegative().default(0),
  recurringOutflows: z.number().finite().nonnegative().default(0),
  sixMonthLiquidity: z.array(SixMonthLiquidityPointSchema).length(6),
  overrideReason: z.string().trim().min(10).max(500).nullable().default(null),
}).strict().superRefine((input, context) => {
  const months = input.sixMonthLiquidity.map((point) => point.month)
  if (new Set(months).size !== months.length) {
    context.addIssue({
      code: 'custom',
      path: ['sixMonthLiquidity'],
      message: 'Six-month liquidity points must use unique months.',
    })
  }

  if (months.some((month, index) => index > 0 && month <= months[index - 1])) {
    context.addIssue({
      code: 'custom',
      path: ['sixMonthLiquidity'],
      message: 'Six-month liquidity points must be in ascending month order.',
    })
  }
})
export type FinancialDecisionTestInput = z.infer<
  typeof FinancialDecisionTestInputSchema
>

export const FinancialDecisionOutcomeSchema = z.enum([
  'allowed',
  'blocked',
  'overridden',
])
export type FinancialDecisionOutcome = z.infer<
  typeof FinancialDecisionOutcomeSchema
>

export const FinancialDecisionPolicyResultSchema = z.object({
  adjustedCash: z.number().finite(),
  adjustedBurnRate: z.number().finite().nonnegative(),
  adjustedRunwayMonths: z.number().finite().nullable(),
  minimumSixMonthLiquidity: z.number().finite(),
  policy: FinancialPolicyEvaluationSchema,
}).strict()
export type FinancialDecisionPolicyResult = z.infer<
  typeof FinancialDecisionPolicyResultSchema
>

export const FinancialDecisionTestResultSchema = z.object({
  policyResult: FinancialDecisionPolicyResultSchema,
  outcome: FinancialDecisionOutcomeSchema,
  overrideReason: z.string().trim().min(10).max(500).nullable(),
}).strict().superRefine((result, context) => {
  const hasOverrideReason = result.overrideReason !== null
  if ((result.outcome === 'overridden') !== hasOverrideReason) {
    context.addIssue({
      code: 'custom',
      path: ['overrideReason'],
      message: 'An override reason is required if and only if the outcome is overridden.',
    })
  }
})
export type FinancialDecisionTestResult = z.infer<
  typeof FinancialDecisionTestResultSchema
>

export const FinancialAnalysisReadinessSchema = z.object({
  status: FinancialAnalysisReadinessStatusSchema,
  availableMetricKeys: z.array(z.enum(FINANCIAL_METRIC_KEYS)),
  missingMetricKeys: z.array(z.enum(FINANCIAL_METRIC_KEYS)),
  historicalObservationCount: z.number().int().min(0).max(12),
  reasons: z.array(z.string().min(1)),
}).strict()
export type FinancialAnalysisReadiness = z.infer<
  typeof FinancialAnalysisReadinessSchema
>

const FinancialAnalysisResultCommonShape = {
  runStatus: FinancialAnalysisRunStatusSchema,
  generatedAt: z.string().datetime(),
  readiness: FinancialAnalysisReadinessSchema,
  sections: FinancialAnalysisSectionsSchema,
  narrative: FinancialAnalysisNarrativeSchema,
  assumptions: z.array(z.string().min(1)),
  agentTrace: FinancialAnalysisAgentTraceSchema,
  policy: FinancialPolicyEvaluationSchema,
  recommendations: z.array(FinancialRecommendationSchema).max(3),
}

export const FinancialAnalysisResultV1Schema = z.object({
  version: z.literal(FINANCIAL_ANALYSIS_RESULT_V1_VERSION),
  ...FinancialAnalysisResultCommonShape,
  selectedBaseline: z.object({
    sourceKey: z.string().min(1),
    sourceLabel: z.string().min(1),
    currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
  }).strict(),
  facts: DeterministicFinancialFactsV1Schema,
  evidence: z.array(FinancialAnalysisEvidenceV1Schema),
}).strict()
export type FinancialAnalysisResultV1 = z.infer<
  typeof FinancialAnalysisResultV1Schema
>

export const FinancialAnalysisSelectedBaselineSchema = z.object({
  mode: FinancialAnalysisSelectionModeSchema,
  sourceKey: z.string().min(1),
  sourceLabel: z.string().min(1),
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
  sources: z.array(FinancialAnalysisSelectedSourceSchema).min(1).max(12),
  reportingPeriodStart: z.string().date(),
  reportingPeriodEnd: z.string().date(),
  reportDate: z.string().date(),
}).strict().superRefine((selection, context) => {
  const sourceKeys = selection.sources.map((source) => source.sourceKey)
  if (new Set(sourceKeys).size !== sourceKeys.length) {
    context.addIssue({
      code: 'custom',
      path: ['sources'],
      message: 'Selected financial sources must be unique.',
    })
  }
  if (selection.sourceKey !== selection.sources[0]?.sourceKey) {
    context.addIssue({
      code: 'custom',
      path: ['sourceKey'],
      message: 'The primary source key must match the first selected source.',
    })
  }
  const expectedSourceCount = selection.mode === 'single' ? 1 : null
  if (expectedSourceCount !== null && selection.sources.length !== expectedSourceCount) {
    context.addIssue({
      code: 'custom',
      path: ['sources'],
      message: 'Single-statement analysis requires exactly one source.',
    })
  }
  if (selection.mode === 'timeline' && selection.sources.length < 2) {
    context.addIssue({
      code: 'custom',
      path: ['sources'],
      message: 'Statement timeline analysis requires at least two sources.',
    })
  }
  if (selection.reportingPeriodStart > selection.reportingPeriodEnd) {
    context.addIssue({
      code: 'custom',
      path: ['reportingPeriodStart'],
      message: 'Reporting period start must not be after the end date.',
    })
  }
  if (selection.reportDate !== selection.reportingPeriodEnd) {
    context.addIssue({
      code: 'custom',
      path: ['reportDate'],
      message: 'Report date must be the latest selected reporting date.',
    })
  }
})
export type FinancialAnalysisSelectedBaseline = z.infer<
  typeof FinancialAnalysisSelectedBaselineSchema
>

export const FinancialAnalysisResultSchema = z.object({
  version: z.literal(FINANCIAL_ANALYSIS_RESULT_VERSION),
  ...FinancialAnalysisResultCommonShape,
  selectedBaseline: FinancialAnalysisSelectedBaselineSchema,
  facts: DeterministicFinancialFactsSchema,
  evidence: z.array(FinancialAnalysisEvidenceSchema),
}).strict()
export type FinancialAnalysisResult = z.infer<
  typeof FinancialAnalysisResultSchema
>

export const PersistedFinancialAnalysisResultSchema = z.discriminatedUnion(
  'version',
  [FinancialAnalysisResultV1Schema, FinancialAnalysisResultSchema]
)
export type PersistedFinancialAnalysisResult = z.infer<
  typeof PersistedFinancialAnalysisResultSchema
>

function sourceMetadata(sourceKey: string) {
  const [rawSourceType, rawId] = sourceKey.split(':')
  const sourceType = [
    'xero',
    'myob',
    'quickbooks',
    'freshbooks',
    'document',
    'manual',
    'demo',
  ].includes(rawSourceType)
    ? rawSourceType as FinancialAnalysisSelectedSource['sourceType']
    : 'manual' as const
  const id = rawId && rawId !== 'label' ? rawId : null
  return {
    sourceType,
    documentId: sourceType === 'document' ? id : null,
    connectionId: sourceType !== 'document' ? id : null,
  }
}

export function normalizeFinancialAnalysisResult(
  result: PersistedFinancialAnalysisResult
): FinancialAnalysisResult {
  if (result.version === FINANCIAL_ANALYSIS_RESULT_VERSION) return result

  const reportingDates = [...new Set(
    result.evidence.map((item) => item.reportingDate)
  )].sort()
  const fallbackDate = result.generatedAt.slice(0, 10)
  const reportingPeriodStart = reportingDates[0] ?? fallbackDate
  const reportingPeriodEnd = reportingDates.at(-1) ?? fallbackDate
  const metadata = sourceMetadata(result.selectedBaseline.sourceKey)

  return FinancialAnalysisResultSchema.parse({
    ...result,
    version: FINANCIAL_ANALYSIS_RESULT_VERSION,
    selectedBaseline: {
      ...result.selectedBaseline,
      mode: 'single',
      sources: [{
        sourceKey: result.selectedBaseline.sourceKey,
        sourceLabel: result.selectedBaseline.sourceLabel,
        ...metadata,
      }],
      reportingPeriodStart,
      reportingPeriodEnd,
      reportDate: reportingPeriodEnd,
    },
    facts: {
      ...result.facts,
      periodComparisons: FINANCIAL_ANALYSIS_COMPARISON_METRIC_KEYS.map(
        (metricKey) => ({
          metricKey,
          earliest: null,
          previous: null,
          latest: null,
          startToLatestChange: null,
          previousToLatestChange: null,
          unavailableReason: 'Period comparison was not stored in this legacy report.',
        })
      ),
    },
    evidence: result.evidence.map((item) => ({
      ...item,
      sourceKey: result.selectedBaseline.sourceKey,
      ...metadata,
      confidence: 1,
      usedInCalculations: true,
      resolution: 'uncontested',
    })),
  })
}
