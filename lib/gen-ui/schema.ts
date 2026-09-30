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
  state: z.discriminatedUnion('status', [
    z.object({ status: z.literal('ready') }),
    z.object({ status: z.literal('loading'), message: z.string().optional() }),
    z.object({ status: z.literal('partial'), message: z.string() }),
    z.object({ status: z.literal('unavailable'), message: z.string() }),
    z.object({ status: z.literal('error'), message: z.string() }),
  ]).optional(),
})

const FinancialKpiDataSchema = z.object({
  metricKey: z.enum(FINANCIAL_METRIC_KEYS),
  label: z.string(),
  value: z.number().nullable(),
  currency: z.string().nullable(),
  reportingDate: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  sourceLabel: z.string(),
  sourceType: z.string(),
  confidence: z.number().nullable(),
})

const FinancialTrendDataSchema = z.object({
  metricKey: z.enum(['monthly_revenue', 'monthly_expenses']),
  label: z.string(),
  currency: z.string().nullable(),
  points: z.array(z.object({
    date: z.string(),
    value: z.number(),
    sourceLabel: z.string(),
    confidence: z.number(),
  })),
  direction: z.enum(['improving', 'worsening', 'stable', 'insufficient_data']),
  change: z.number().nullable(),
  percentageChange: z.number().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  note: z.string(),
})

const CashBalanceWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('cash_balance'),
  data: FinancialKpiDataSchema.extend({ metricKey: z.literal('cash') }),
})

const RevenueSnapshotWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('revenue_snapshot'),
  data: FinancialKpiDataSchema.extend({ metricKey: z.literal('monthly_revenue') }),
})

const ExpenseSummaryWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('expense_summary'),
  data: FinancialKpiDataSchema.extend({ metricKey: z.literal('monthly_expenses') }),
})

const AccountsReceivableWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('accounts_receivable'),
  data: FinancialKpiDataSchema.extend({ metricKey: z.literal('accounts_receivable') }),
})

const AccountsPayableWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('accounts_payable'),
  data: FinancialKpiDataSchema.extend({ metricKey: z.literal('accounts_payable') }),
})

const RevenueTrendWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('revenue_trend'),
  data: FinancialTrendDataSchema.extend({ metricKey: z.literal('monthly_revenue') }),
})

const ExpenseTrendWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('expense_trend'),
  data: FinancialTrendDataSchema.extend({ metricKey: z.literal('monthly_expenses') }),
})

const RevenueGrowthWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('revenue_growth'),
  data: z.object({
    currentValue: z.number().nullable(),
    previousValue: z.number().nullable(),
    growthPercentage: z.number().nullable(),
    currency: z.string().nullable(),
    currentPeriod: z.string().nullable(),
    previousPeriod: z.string().nullable(),
    direction: z.enum(['up', 'down', 'stable', 'unavailable']),
    sourceLabels: z.array(z.string()),
  }),
})

const AiFinancialBriefWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('ai_financial_brief'),
  data: z.object({
    summary: z.string(),
    facts: z.array(z.object({
      label: z.string(),
      value: z.string(),
      detail: z.string(),
      tone: z.enum(['positive', 'warning', 'neutral']),
      sourceLabel: z.string(),
    })).max(5),
  }),
})

const FinancialSummaryDataSchema = z.object({
  currency: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  sourceLabel: z.string(),
  metrics: z.array(z.object({
    label: z.string(),
    value: z.number().nullable(),
    percentage: z.number().nullable().optional(),
    comparisonPercentage: z.number().nullable().optional(),
    comparisonLabel: z.string().nullable().optional(),
    tone: z.enum(['positive', 'warning', 'neutral']),
  })),
  note: z.string(),
})

const FinancialForecastDataSchema = z.object({
  label: z.string(),
  currency: z.string().nullable(),
  actualPoints: z.array(z.object({ date: z.string(), value: z.number() })),
  forecastPoints: z.array(z.object({ date: z.string(), value: z.number() })),
  method: z.string(),
  assumptions: z.array(z.string()),
})

const CashFlowSummaryWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('cash_flow_summary'),
  data: FinancialSummaryDataSchema,
})
const CashFlowForecastWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('cash_flow_forecast'),
  data: FinancialForecastDataSchema.extend({
    openingCash: z.number().nullable(),
    horizonDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  }),
})
const RevenueForecastWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('revenue_forecast'),
  data: FinancialForecastDataSchema,
})
const ProfitSnapshotWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('profit_snapshot'),
  data: FinancialSummaryDataSchema,
})
const ProfitTrendWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('profit_trend'),
  data: FinancialForecastDataSchema.extend({ profitType: z.enum(['gross', 'operating', 'net']) }),
})
const ProfitForecastWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('profit_forecast'),
  data: FinancialForecastDataSchema.extend({ profitType: z.enum(['gross', 'operating', 'net']) }),
})
const ProfitMarginWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('profit_margin'),
  data: FinancialSummaryDataSchema.extend({ marginType: z.enum(['gross', 'operating', 'net']) }),
})
const BreakEvenAnalysisWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('break_even_analysis'),
  data: z.object({
    currency: z.string().nullable(),
    revenue: z.number().nullable(),
    fixedCosts: z.number().nullable(),
    variableCosts: z.number().nullable(),
    contributionMarginPercentage: z.number().nullable(),
    breakEvenRevenue: z.number().nullable(),
    unclassifiedCostAmount: z.number(),
    note: z.string(),
  }),
})
const BreakEvenProgressWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('break_even_progress'),
  data: z.object({
    currency: z.string().nullable(),
    currentRevenue: z.number().nullable(),
    breakEvenRevenue: z.number().nullable(),
    progressPercentage: z.number().nullable(),
    remainingRevenue: z.number().nullable(),
    note: z.string(),
  }),
})
const ExpenseBreakdownWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('expense_breakdown'),
  data: z.object({
    currency: z.string().nullable(),
    periodStart: z.string().nullable(),
    periodEnd: z.string().nullable(),
    categories: z.array(z.object({ label: z.string(), amount: z.number(), percentage: z.number() })),
  }),
})
const LargestExpensesWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('largest_expenses'),
  data: z.object({
    currency: z.string().nullable(),
    items: z.array(z.object({
      id: z.string(),
      label: z.string(),
      counterparty: z.string().nullable(),
      date: z.string(),
      amount: z.number(),
      category: z.string().nullable(),
    })),
  }),
})
const ExpenseChangeDetectorWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('expense_change_detector'),
  data: z.object({
    currency: z.string().nullable(),
    changes: z.array(z.object({
      category: z.string(),
      currentAmount: z.number(),
      previousAmount: z.number(),
      change: z.number(),
      percentageChange: z.number().nullable(),
    })),
  }),
})
const BudgetWidgetDataSchema = z.object({
  budgetName: z.string().nullable(),
  currency: z.string().nullable(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  totalBudget: z.number().nullable(),
  totalActual: z.number().nullable(),
  totalRemaining: z.number().nullable(),
  projectedActual: z.number().nullable(),
  projectedVariance: z.number().nullable(),
  elapsedPercentage: z.number().nullable(),
  lines: z.array(z.object({
    label: z.string(),
    budgetAmount: z.number(),
    actualAmount: z.number(),
    variance: z.number(),
    remaining: z.number(),
  })),
})
const BudgetVsActualWidgetSchema = WidgetBaseSchema.extend({ type: z.literal('budget_vs_actual'), data: BudgetWidgetDataSchema })
const BudgetRemainingWidgetSchema = WidgetBaseSchema.extend({ type: z.literal('budget_remaining'), data: BudgetWidgetDataSchema })
const BudgetForecastWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('budget_forecast'),
  data: BudgetWidgetDataSchema.extend({ method: z.string(), assumptions: z.array(z.string()) }),
})
const CashInflowForecastWidgetSchema = WidgetBaseSchema.extend({ type: z.literal('cash_inflow_forecast'), data: FinancialForecastDataSchema })
const CashOutflowForecastWidgetSchema = WidgetBaseSchema.extend({ type: z.literal('cash_outflow_forecast'), data: FinancialForecastDataSchema })

const InvoiceBalanceItemDataSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  issueDate: z.string(),
  dueDate: z.string(),
  outstandingAmount: z.number(),
  daysOverdue: z.number().int().nonnegative().nullable(),
})
const InvoiceBalanceGroupDataSchema = z.object({
  currency: z.string(),
  sourceLabel: z.string(),
  count: z.number().int().nonnegative(),
  totalOutstanding: z.number().nonnegative(),
  items: z.array(InvoiceBalanceItemDataSchema),
})
const OverdueInvoicesWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('overdue_invoices'),
  data: z.object({
    asOfDate: z.string(),
    groups: z.array(InvoiceBalanceGroupDataSchema),
    note: z.string(),
  }),
})
const InvoiceAgeingWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('invoice_ageing'),
  data: z.object({
    asOfDate: z.string(),
    groups: z.array(z.object({
      currency: z.string(),
      sourceLabel: z.string(),
      totalOutstanding: z.number().nonnegative(),
      buckets: z.array(z.object({
        key: z.enum(['days_0_30', 'days_31_60', 'days_61_90', 'days_90_plus']),
        label: z.string(),
        count: z.number().int().nonnegative(),
        amount: z.number().nonnegative(),
        percentage: z.number().min(0).max(100),
      })),
    })),
    note: z.string(),
  }),
})
const UpcomingInvoiceDataSchema = z.object({
  asOfDate: z.string(),
  throughDate: z.string(),
  horizonDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  groups: z.array(InvoiceBalanceGroupDataSchema),
  note: z.string(),
})
const ExpectedPaymentsWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('expected_payments'),
  data: UpcomingInvoiceDataSchema.extend({ method: z.string() }),
})
const BillsDueWidgetSchema = WidgetBaseSchema.extend({
  type: z.literal('bills_due'),
  data: UpcomingInvoiceDataSchema,
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
  CashBalanceWidgetSchema,
  RevenueSnapshotWidgetSchema,
  RevenueTrendWidgetSchema,
  RevenueGrowthWidgetSchema,
  ExpenseSummaryWidgetSchema,
  ExpenseTrendWidgetSchema,
  AccountsReceivableWidgetSchema,
  AccountsPayableWidgetSchema,
  AiFinancialBriefWidgetSchema,
  CashFlowSummaryWidgetSchema,
  CashFlowForecastWidgetSchema,
  RevenueForecastWidgetSchema,
  ProfitSnapshotWidgetSchema,
  ProfitTrendWidgetSchema,
  ProfitForecastWidgetSchema,
  ProfitMarginWidgetSchema,
  BreakEvenAnalysisWidgetSchema,
  BreakEvenProgressWidgetSchema,
  ExpenseBreakdownWidgetSchema,
  LargestExpensesWidgetSchema,
  ExpenseChangeDetectorWidgetSchema,
  BudgetVsActualWidgetSchema,
  BudgetRemainingWidgetSchema,
  BudgetForecastWidgetSchema,
  CashInflowForecastWidgetSchema,
  CashOutflowForecastWidgetSchema,
  OverdueInvoicesWidgetSchema,
  InvoiceAgeingWidgetSchema,
  ExpectedPaymentsWidgetSchema,
  BillsDueWidgetSchema,
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
