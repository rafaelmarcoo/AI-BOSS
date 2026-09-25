import { z } from 'zod'
import { SUPPORTED_FINANCIAL_CURRENCIES } from '@/lib/financial-data/currency'

export const SCENARIO_HORIZONS = [3, 6, 12, 24] as const
export const SCENARIO_TREND_RANGES = ['3m', '6m', 'all'] as const
export const SCENARIO_PERCENTAGE_METRICS = [
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
] as const

const MonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a calendar month in YYYY-MM format.')

const AdjustmentBaseSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(80),
  startMonth: MonthSchema,
  endMonth: MonthSchema.optional(),
})

export const FixedScenarioAdjustmentSchema = AdjustmentBaseSchema.extend({
  kind: z.literal('fixed'),
  flow: z.enum(['inflow', 'outflow']),
  frequency: z.enum(['one_off', 'recurring']),
  amount: z.number().finite().positive(),
}).superRefine((adjustment, context) => {
  if (adjustment.frequency === 'one_off' && adjustment.endMonth) {
    context.addIssue({
      code: 'custom',
      path: ['endMonth'],
      message: 'A one-off adjustment cannot have an end month.',
    })
  }
})

export const PercentageScenarioAdjustmentSchema = AdjustmentBaseSchema.extend({
  kind: z.literal('percentage'),
  mode: z.enum(['step', 'compound']),
  metric: z.enum(SCENARIO_PERCENTAGE_METRICS),
  percentageChange: z.number().finite().min(-100).max(1000),
})

export const ScenarioAdjustmentSchema = z.union([
  FixedScenarioAdjustmentSchema,
  PercentageScenarioAdjustmentSchema,
])

export const ScenarioDefinitionSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1).max(80),
  adjustments: z.array(ScenarioAdjustmentSchema).min(1).max(10),
})

export const ManualScenarioBaselineSchema = z.object({
  cash: z.number().finite().nonnegative().optional(),
  accountsReceivable: z.number().finite().nonnegative().optional(),
  accountsPayable: z.number().finite().nonnegative().optional(),
  burnRate: z.number().finite().nonnegative().optional(),
  monthlyRevenue: z.number().finite().nonnegative().optional(),
  monthlyExpenses: z.number().finite().nonnegative().optional(),
  asOfMonth: MonthSchema.optional(),
}).default({})

const ScenarioAnalysisInputBodySchema = z.object({
  currency: z.enum(SUPPORTED_FINANCIAL_CURRENCIES),
  horizon: z.union([
    z.literal(3),
    z.literal(6),
    z.literal(12),
    z.literal(24),
  ]).default(6),
  trendRange: z.enum(SCENARIO_TREND_RANGES).default('6m'),
  manualBaseline: ManualScenarioBaselineSchema,
  scenarios: z.array(ScenarioDefinitionSchema).min(1).max(3),
})

export const LegacyScenarioAnalysisInputSchema = ScenarioAnalysisInputBodySchema.extend({
  sourceKey: z.string().min(1),
})

export const SCENARIO_ANALYSIS_INPUT_VERSION = 'scenario-analysis-v2' as const

export const ScenarioBaselineReferenceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('source'),
    sourceKey: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('analysis_run'),
    analysisRunId: z.string().min(1),
  }).strict(),
])

export const ScenarioAnalysisInputV2Schema = ScenarioAnalysisInputBodySchema.extend({
  version: z.literal(SCENARIO_ANALYSIS_INPUT_VERSION),
  baseline: ScenarioBaselineReferenceSchema,
})

export const ScenarioAnalysisInputSchema = z.union([
  LegacyScenarioAnalysisInputSchema,
  ScenarioAnalysisInputV2Schema,
])

export type ScenarioHorizon = (typeof SCENARIO_HORIZONS)[number]
export type ScenarioTrendRange = (typeof SCENARIO_TREND_RANGES)[number]
export type ScenarioPercentageMetric =
  (typeof SCENARIO_PERCENTAGE_METRICS)[number]
export type ScenarioAdjustment = z.infer<typeof ScenarioAdjustmentSchema>
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>
export type ManualScenarioBaseline = z.infer<typeof ManualScenarioBaselineSchema>
export type ScenarioBaselineReference = z.infer<
  typeof ScenarioBaselineReferenceSchema
>
export type ScenarioAnalysisInput = z.infer<typeof ScenarioAnalysisInputSchema>
export type ScenarioAnalysisInputV2 = z.infer<
  typeof ScenarioAnalysisInputV2Schema
>

export function getScenarioBaselineReference(
  input: ScenarioAnalysisInput
): ScenarioBaselineReference {
  return 'baseline' in input
    ? input.baseline
    : { kind: 'source', sourceKey: input.sourceKey }
}

export function getScenarioInputSourceKey(input: ScenarioAnalysisInput) {
  const baseline = getScenarioBaselineReference(input)
  return baseline.kind === 'source' ? baseline.sourceKey : null
}

export function toScenarioAnalysisInputV2(
  input: ScenarioAnalysisInput
): ScenarioAnalysisInputV2 {
  if ('baseline' in input) return input
  return {
    version: SCENARIO_ANALYSIS_INPUT_VERSION,
    baseline: { kind: 'source', sourceKey: input.sourceKey },
    currency: input.currency,
    horizon: input.horizon,
    trendRange: input.trendRange,
    manualBaseline: input.manualBaseline,
    scenarios: input.scenarios,
  }
}
