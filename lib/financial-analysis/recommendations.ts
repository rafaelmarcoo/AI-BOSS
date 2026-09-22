import { z } from 'zod'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import {
  FinancialAnalysisReadinessStatusSchema,
  FinancialRecommendationSchema,
  TrendDirectionSchema,
  type FinancialRecommendation,
} from '@/lib/financial-analysis/types'

export const RecommendationSelectionInputSchema = z.object({
  readinessStatus: FinancialAnalysisReadinessStatusSchema,
  missingMetricKeys: z.array(z.enum(FINANCIAL_METRIC_KEYS)),
  runwayStatus: z.enum(['urgent', 'caution', 'healthy']).nullable(),
  operatingBalance: z.number().finite().nullable(),
  cashTrend: TrendDirectionSchema,
  burnTrend: TrendDirectionSchema,
  workingCapitalPosition: z.enum([
    'net_receivable',
    'net_payable',
    'balanced',
  ]).nullable(),
}).strict()

export type RecommendationSelectionInput = z.infer<
  typeof RecommendationSelectionInputSchema
>

export function selectFinancialRecommendations(
  input: RecommendationSelectionInput
): FinancialRecommendation[] {
  const parsed = RecommendationSelectionInputSchema.parse(input)
  const candidates: Omit<FinancialRecommendation, 'priority'>[] = []

  if (parsed.readinessStatus !== 'ready') {
    candidates.push({
      id: 'fix_data_gaps',
      reason: parsed.missingMetricKeys.length > 0
        ? `Confirm the missing trusted metrics: ${parsed.missingMetricKeys.join(', ')}.`
        : 'Resolve the source, currency, or history limitation before relying on the full report.',
    })
  }

  if (parsed.runwayStatus === 'urgent') {
    candidates.push({
      id: 'protect_runway_now',
      reason: 'Cash runway is under 3 months, so immediate liquidity action has the highest financial priority.',
    })
  }

  if (parsed.operatingBalance !== null && parsed.operatingBalance < 0) {
    candidates.push({
      id: 'restore_operating_balance',
      reason: 'Monthly expenses exceed monthly revenue, producing a negative operating balance.',
    })
  }

  if (parsed.cashTrend === 'worsening' || parsed.burnTrend === 'worsening') {
    candidates.push({
      id: 'address_worsening_cash_or_burn',
      reason: 'Cash or burn is moving in an unfavourable direction across the selected history.',
    })
  }

  if (
    parsed.workingCapitalPosition === 'net_receivable' ||
    parsed.workingCapitalPosition === 'net_payable'
  ) {
    candidates.push({
      id: 'improve_collections_and_payable_timing',
      reason: 'Receivable and payable timing materially affects the working-capital liquidity proxy.',
    })
  }

  if (parsed.runwayStatus === 'caution') {
    candidates.push({
      id: 'build_runway_buffer',
      reason: 'Cash runway is from 3 months to under 6 months and remains below the healthy buffer.',
    })
  }

  return candidates.slice(0, 3).map((recommendation, index) =>
    FinancialRecommendationSchema.parse({
      ...recommendation,
      priority: index + 1,
    })
  )
}
