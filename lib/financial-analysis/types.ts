import { z } from 'zod'
import { SUPPORTED_FINANCIAL_CURRENCIES } from '@/lib/financial-data/currency'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'

export const FINANCIAL_ANALYSIS_RESULT_VERSION = 'financial-analysis-v1' as const
export const FINANCIAL_ANALYSIS_POLICY_VERSION = 'mvp-v1' as const

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

export const DeterministicFinancialFactsSchema = z.object({
  operatingBalance: OperatingBalanceFactSchema.nullable(),
  receivablesPayables: ReceivablesPayablesFactSchema.nullable(),
  runway: RunwayFactsSchema.nullable(),
  history: z.array(FinancialTrendFactSchema),
  forecasts: z.array(FinancialForecastFactSchema),
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

export const FinancialAnalysisEvidenceSchema = z.object({
  observationId: z.string().min(1),
  metricKey: z.enum(FINANCIAL_METRIC_KEYS),
  value: z.number().finite(),
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES).nullable(),
  reportingDate: z.string().date(),
  sourceLabel: z.string().min(1),
}).strict()
export type FinancialAnalysisEvidence = z.infer<
  typeof FinancialAnalysisEvidenceSchema
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

export const FinancialAnalysisResultSchema = z.object({
  version: z.literal(FINANCIAL_ANALYSIS_RESULT_VERSION),
  runStatus: FinancialAnalysisRunStatusSchema,
  generatedAt: z.string().datetime(),
  selectedBaseline: z.object({
    sourceKey: z.string().min(1),
    sourceLabel: z.string().min(1),
    currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
  }).strict(),
  readiness: FinancialAnalysisReadinessSchema,
  sections: FinancialAnalysisSectionsSchema,
  facts: DeterministicFinancialFactsSchema,
  narrative: FinancialAnalysisNarrativeSchema,
  evidence: z.array(FinancialAnalysisEvidenceSchema),
  assumptions: z.array(z.string().min(1)),
  agentTrace: FinancialAnalysisAgentTraceSchema,
  policy: FinancialPolicyEvaluationSchema,
  recommendations: z.array(FinancialRecommendationSchema).max(3),
}).strict()
export type FinancialAnalysisResult = z.infer<
  typeof FinancialAnalysisResultSchema
>
