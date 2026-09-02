import { z } from 'zod'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import { GEN_UI_PLAN_VERSION, GEN_UI_WIDGET_TYPES } from '@/lib/gen-ui/types'
import type { GenUiPlan } from '@/lib/gen-ui/types'
import { isScenarioAnalysisResult } from '@/lib/scenarios/calculation'
import type { ScenarioAnalysisResult } from '@/lib/scenarios/calculation'

const WidgetBaseSchema = z.object({
  id: z.string(),
  type: z.enum(GEN_UI_WIDGET_TYPES),
  title: z.string(),
  reason: z.string(),
})

const MetricSnapshotWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('metric_snapshot'),
  data: z.object({
    metrics: z.array(
      z.object({
        key: z.enum(FINANCIAL_METRIC_KEYS),
        runwayVariant: z.enum(['cash', 'working_capital_adjusted']).optional(),
        label: z.string(),
        value: z.string(),
        unit: z.string().nullable(),
        sourceLabel: z.string(),
        sourceTone: z.enum(['available', 'unavailable', 'derived']),
        reportingDate: z.string().nullable().optional(),
        dateStatus: z
          .enum(['latest_recorded', 'calculated_for', 'unavailable_for', 'undated'])
          .optional(),
        calculationRole: z
          .enum(['used', 'compatible_input', 'context_only', 'derived', 'unavailable'])
          .optional(),
        detail: z.string().nullable().optional(),
      })
    ).max(4),
  }),
})

const DataConnectionsWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('data_connections'),
  data: z.object({
    message: z.string(),
  }),
})

const MetricTrendChartWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('metric_trend_chart'),
  data: z.object({
    metricKey: z.enum(FINANCIAL_METRIC_KEYS),
    label: z.string(),
    currency: z.string().nullable(),
    points: z.array(
      z.object({
        date: z.string(),
        value: z.number(),
        sourceLabel: z.string(),
        confidence: z.number(),
      })
    ),
    direction: z.enum(['improving', 'worsening', 'stable', 'insufficient_data']),
    totalChange: z.number().nullable(),
    hasMixedSources: z.boolean(),
    hasRecordedDateFallback: z.boolean(),
    note: z.string(),
    runwaySeries: z.array(z.object({
      variant: z.enum(['cash', 'working_capital_adjusted']),
      label: z.string(),
      points: z.array(z.object({
        date: z.string(),
        value: z.number(),
        sourceLabel: z.string(),
        confidence: z.number(),
      })),
    })).optional(),
  }),
})

const MetricForecastChartWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('metric_forecast_chart'),
  data: z.object({
    metricKey: z.enum(FINANCIAL_METRIC_KEYS),
    label: z.string(),
    currency: z.string().nullable(),
    actualPoints: z.array(
      z.object({
        date: z.string(),
        value: z.number(),
        sourceLabel: z.string(),
        confidence: z.number(),
      })
    ),
    forecastPoints: z.array(z.object({ date: z.string(), value: z.number() })),
    horizon: z.union([z.literal(3), z.literal(6)]),
    monthlySlope: z.number(),
    hasMixedSources: z.boolean(),
    hasRecordedDateFallback: z.boolean(),
    note: z.string(),
    runwaySeries: z.array(z.object({
      variant: z.enum(['cash', 'working_capital_adjusted']),
      label: z.string(),
      actualPoints: z.array(z.object({
        date: z.string(),
        value: z.number(),
        sourceLabel: z.string(),
        confidence: z.number(),
      })),
      forecastPoints: z.array(z.object({ date: z.string(), value: z.number() })),
    })).optional(),
  }),
})

const ScenarioComparisonWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('scenario_comparison'),
  data: z.object({
    currency: z.enum(['NZD', 'AUD']),
    base: z.object({
      label: z.string(),
      monthlyBurn: z.number().nullable(),
      runwayMonths: z.number().nullable(),
    }),
    scenarios: z.array(
      z.object({
        label: z.string(),
        monthlyBurn: z.number().nullable(),
        runwayMonths: z.number().nullable(),
        deltaMonths: z.number().nullable(),
      })
    ),
    note: z.string(),
  }),
})

const ScenarioAnalysisWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('scenario_analysis'),
  data: z.object({
    result: z.custom<ScenarioAnalysisResult>(isScenarioAnalysisResult),
    editHref: z.string(),
  }),
})

const PlanningChecklistWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('planning_checklist'),
  data: z.object({
    items: z.array(
      z.object({
        label: z.string(),
        detail: z.string(),
        tone: z.enum(['urgent', 'watch', 'steady']),
      })
    ),
  }),
})

const RiskThresholdTimelineWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('risk_threshold_timeline'),
  data: z.object({
    currentRunway: z.number().nullable(),
    workingCapitalAdjustedRunway: z.number().nullable().optional(),
    monthsUntilCaution: z.number().nullable(),
    monthsUntilUrgent: z.number().nullable(),
    status: z.enum(['urgent', 'caution', 'healthy', 'unknown']),
    message: z.string(),
  }),
})

const MetricSourceEvidenceWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('metric_source_evidence'),
  data: z.object({
    metrics: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        sourceLabel: z.string(),
        sourceType: z.string(),
        confidence: z.number().nullable(),
        tone: z.enum(['available', 'unavailable', 'derived']),
        reportingDate: z.string().nullable().optional(),
        dateStatus: z
          .enum(['latest_recorded', 'calculated_for', 'unavailable_for', 'undated'])
          .optional(),
        calculationRole: z
          .enum(['used', 'compatible_input', 'context_only', 'derived', 'unavailable'])
          .optional(),
        detail: z.string().nullable().optional(),
      })
    ),
  }),
})

const MissingDataPanelWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('missing_data_panel'),
  data: z.object({
    missingMetrics: z.array(z.string()),
    message: z.string(),
  }),
})

const HighlightExplainerWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('highlight_explainer'),
  data: z.object({
    selectedText: z.string(),
    prompt: z.string(),
  }),
})

export const GenUiWidgetSchema = z.discriminatedUnion('type', [
  MetricSnapshotWidgetSchema,
  DataConnectionsWidgetSchema,
  MetricTrendChartWidgetSchema,
  MetricForecastChartWidgetSchema,
  ScenarioComparisonWidgetSchema,
  ScenarioAnalysisWidgetSchema,
  PlanningChecklistWidgetSchema,
  RiskThresholdTimelineWidgetSchema,
  MetricSourceEvidenceWidgetSchema,
  MissingDataPanelWidgetSchema,
  HighlightExplainerWidgetSchema,
])

export const GenUiPlanSchema = z.object({
  version: z.literal(GEN_UI_PLAN_VERSION),
  source: z.enum(['chat', 'selection']),
  generatedAt: z.string(),
  summary: z.string(),
  widgets: z.array(GenUiWidgetSchema).max(4),
  workspaceMode: z.enum(['financial', 'document_review']).optional(),
  documentReviewSnapshot: z.object({
    documentIds: z.array(z.string().uuid()).min(1),
    statusAtGeneration: z.literal('pending'),
  }).optional(),
})

export function parseGenUiPlan(input: unknown): GenUiPlan | null {
  const result = GenUiPlanSchema.safeParse(input)

  return result.success ? result.data : null
}
