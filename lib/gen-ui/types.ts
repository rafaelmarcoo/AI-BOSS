import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { ScenarioAnalysisResult } from '@/lib/scenarios/calculation'

export const GEN_UI_PLAN_VERSION = 1

export const GEN_UI_WIDGET_TYPES = [
  'metric_snapshot',
  'data_connections',
  'metric_trend_chart',
  'metric_forecast_chart',
  'scenario_comparison',
  'scenario_analysis',
  'planning_checklist',
  'risk_threshold_timeline',
  'metric_source_evidence',
  'missing_data_panel',
  'highlight_explainer',
  'cash_balance',
  'revenue_snapshot',
  'revenue_trend',
  'revenue_growth',
  'expense_summary',
  'expense_trend',
  'accounts_receivable',
  'accounts_payable',
  'ai_financial_brief',
  'cash_flow_summary',
  'cash_flow_forecast',
  'revenue_forecast',
  'profit_snapshot',
  'profit_trend',
  'profit_forecast',
  'profit_margin',
  'break_even_analysis',
  'break_even_progress',
  'expense_breakdown',
  'largest_expenses',
  'expense_change_detector',
  'budget_vs_actual',
  'budget_remaining',
  'budget_forecast',
  'cash_inflow_forecast',
  'cash_outflow_forecast',
] as const

export type GenUiWidgetType = (typeof GEN_UI_WIDGET_TYPES)[number]

export type GenUiSource = 'chat' | 'selection'

export type GenUiMetricDateStatus =
  | 'latest_recorded'
  | 'calculated_for'
  | 'unavailable_for'
  | 'undated'

export type GenUiMetricCalculationRole =
  | 'used'
  | 'compatible_input'
  | 'context_only'
  | 'derived'
  | 'unavailable'

export interface GenUiWidgetBase {
  id: string
  type: GenUiWidgetType
  title: string
  reason: string
  state?: GenUiWidgetState
}

export type GenUiWidgetState =
  | { status: 'ready' }
  | { status: 'loading'; message?: string }
  | { status: 'partial'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }

export interface FinancialKpiData {
  metricKey: FinancialMetricKey
  label: string
  value: number | null
  currency: string | null
  reportingDate: string | null
  periodStart: string | null
  periodEnd: string | null
  sourceLabel: string
  sourceType: string
  confidence: number | null
}

export interface FinancialTrendPoint {
  date: string
  value: number
  sourceLabel: string
  confidence: number
}

export interface FinancialTrendData {
  metricKey: 'monthly_revenue' | 'monthly_expenses'
  label: string
  currency: string | null
  points: FinancialTrendPoint[]
  direction: 'improving' | 'worsening' | 'stable' | 'insufficient_data'
  change: number | null
  percentageChange: number | null
  periodStart: string | null
  periodEnd: string | null
  note: string
}

export interface CashBalanceWidget extends GenUiWidgetBase {
  type: 'cash_balance'
  data: FinancialKpiData & { metricKey: 'cash' }
}

export interface RevenueSnapshotWidget extends GenUiWidgetBase {
  type: 'revenue_snapshot'
  data: FinancialKpiData & { metricKey: 'monthly_revenue' }
}

export interface ExpenseSummaryWidget extends GenUiWidgetBase {
  type: 'expense_summary'
  data: FinancialKpiData & { metricKey: 'monthly_expenses' }
}

export interface AccountsReceivableWidget extends GenUiWidgetBase {
  type: 'accounts_receivable'
  data: FinancialKpiData & { metricKey: 'accounts_receivable' }
}

export interface AccountsPayableWidget extends GenUiWidgetBase {
  type: 'accounts_payable'
  data: FinancialKpiData & { metricKey: 'accounts_payable' }
}

export interface RevenueTrendWidget extends GenUiWidgetBase {
  type: 'revenue_trend'
  data: FinancialTrendData & { metricKey: 'monthly_revenue' }
}

export interface ExpenseTrendWidget extends GenUiWidgetBase {
  type: 'expense_trend'
  data: FinancialTrendData & { metricKey: 'monthly_expenses' }
}

export interface RevenueGrowthWidget extends GenUiWidgetBase {
  type: 'revenue_growth'
  data: {
    currentValue: number | null
    previousValue: number | null
    growthPercentage: number | null
    currency: string | null
    currentPeriod: string | null
    previousPeriod: string | null
    direction: 'up' | 'down' | 'stable' | 'unavailable'
    sourceLabels: string[]
  }
}

export interface AiFinancialBriefWidget extends GenUiWidgetBase {
  type: 'ai_financial_brief'
  data: {
    summary: string
    facts: Array<{
      label: string
      value: string
      detail: string
      tone: 'positive' | 'warning' | 'neutral'
      sourceLabel: string
    }>
  }
}

export interface FinancialSummaryMetric {
  label: string
  value: number | null
  percentage?: number | null
  comparisonPercentage?: number | null
  comparisonLabel?: string | null
  tone: 'positive' | 'warning' | 'neutral'
}

export interface FinancialSummaryData {
  currency: string | null
  periodStart: string | null
  periodEnd: string | null
  sourceLabel: string
  metrics: FinancialSummaryMetric[]
  note: string
}

export interface FinancialForecastData {
  label: string
  currency: string | null
  actualPoints: Array<{ date: string; value: number }>
  forecastPoints: Array<{ date: string; value: number }>
  method: string
  assumptions: string[]
}

export interface CashFlowSummaryWidget extends GenUiWidgetBase {
  type: 'cash_flow_summary'
  data: FinancialSummaryData
}

export interface CashFlowForecastWidget extends GenUiWidgetBase {
  type: 'cash_flow_forecast'
  data: FinancialForecastData & { openingCash: number | null; horizonDays: 30 | 60 | 90 }
}

export interface RevenueForecastWidget extends GenUiWidgetBase {
  type: 'revenue_forecast'
  data: FinancialForecastData
}

export interface ProfitSnapshotWidget extends GenUiWidgetBase {
  type: 'profit_snapshot'
  data: FinancialSummaryData
}

export interface ProfitTrendWidget extends GenUiWidgetBase {
  type: 'profit_trend'
  data: FinancialForecastData & { profitType: 'gross' | 'operating' | 'net' }
}

export interface ProfitForecastWidget extends GenUiWidgetBase {
  type: 'profit_forecast'
  data: FinancialForecastData & { profitType: 'gross' | 'operating' | 'net' }
}

export interface ProfitMarginWidget extends GenUiWidgetBase {
  type: 'profit_margin'
  data: FinancialSummaryData & { marginType: 'gross' | 'operating' | 'net' }
}

export interface BreakEvenAnalysisWidget extends GenUiWidgetBase {
  type: 'break_even_analysis'
  data: {
    currency: string | null
    revenue: number | null
    fixedCosts: number | null
    variableCosts: number | null
    contributionMarginPercentage: number | null
    breakEvenRevenue: number | null
    unclassifiedCostAmount: number
    note: string
  }
}

export interface BreakEvenProgressWidget extends GenUiWidgetBase {
  type: 'break_even_progress'
  data: {
    currency: string | null
    currentRevenue: number | null
    breakEvenRevenue: number | null
    progressPercentage: number | null
    remainingRevenue: number | null
    note: string
  }
}

export interface ExpenseBreakdownWidget extends GenUiWidgetBase {
  type: 'expense_breakdown'
  data: {
    currency: string | null
    periodStart: string | null
    periodEnd: string | null
    categories: Array<{ label: string; amount: number; percentage: number }>
  }
}

export interface LargestExpensesWidget extends GenUiWidgetBase {
  type: 'largest_expenses'
  data: {
    currency: string | null
    items: Array<{
      id: string
      label: string
      counterparty: string | null
      date: string
      amount: number
      category: string | null
    }>
  }
}

export interface ExpenseChangeDetectorWidget extends GenUiWidgetBase {
  type: 'expense_change_detector'
  data: {
    currency: string | null
    changes: Array<{
      category: string
      currentAmount: number
      previousAmount: number
      change: number
      percentageChange: number | null
    }>
  }
}

export interface BudgetWidgetData {
  budgetName: string | null
  currency: string | null
  periodStart: string | null
  periodEnd: string | null
  totalBudget: number | null
  totalActual: number | null
  totalRemaining: number | null
  projectedActual: number | null
  projectedVariance: number | null
  elapsedPercentage: number | null
  lines: Array<{
    label: string
    budgetAmount: number
    actualAmount: number
    variance: number
    remaining: number
  }>
}

export interface BudgetVsActualWidget extends GenUiWidgetBase {
  type: 'budget_vs_actual'
  data: BudgetWidgetData
}

export interface BudgetRemainingWidget extends GenUiWidgetBase {
  type: 'budget_remaining'
  data: BudgetWidgetData
}

export interface BudgetForecastWidget extends GenUiWidgetBase {
  type: 'budget_forecast'
  data: BudgetWidgetData & { method: string; assumptions: string[] }
}

export interface CashInflowForecastWidget extends GenUiWidgetBase {
  type: 'cash_inflow_forecast'
  data: FinancialForecastData
}

export interface CashOutflowForecastWidget extends GenUiWidgetBase {
  type: 'cash_outflow_forecast'
  data: FinancialForecastData
}

export interface MetricSnapshotWidget extends GenUiWidgetBase {
  type: 'metric_snapshot'
  data: {
    metrics: Array<{
      key: FinancialMetricKey
      runwayVariant?: 'cash' | 'working_capital_adjusted'
      label: string
      value: string
      unit: string | null
      sourceLabel: string
      sourceTone: 'available' | 'unavailable' | 'derived'
      reportingDate?: string | null
      dateStatus?: GenUiMetricDateStatus
      calculationRole?: GenUiMetricCalculationRole
      detail?: string | null
    }>
  }
}

export interface DataConnectionsWidget extends GenUiWidgetBase {
  type: 'data_connections'
  data: {
    message: string
  }
}

export interface MetricTrendChartWidget extends GenUiWidgetBase {
  type: 'metric_trend_chart'
  data: {
    metricKey: FinancialMetricKey
    label: string
    currency: string | null
    points: Array<{
      date: string
      value: number
      sourceLabel: string
      confidence: number
    }>
    direction: 'improving' | 'worsening' | 'stable' | 'insufficient_data'
    totalChange: number | null
    hasMixedSources: boolean
    hasRecordedDateFallback: boolean
    note: string
    runwaySeries?: Array<{
      variant: 'cash' | 'working_capital_adjusted'
      label: string
      points: Array<{
        date: string
        value: number
        sourceLabel: string
        confidence: number
      }>
    }>
  }
}

export interface MetricForecastChartWidget extends GenUiWidgetBase {
  type: 'metric_forecast_chart'
  data: {
    metricKey: FinancialMetricKey
    label: string
    currency: string | null
    actualPoints: Array<{
      date: string
      value: number
      sourceLabel: string
      confidence: number
    }>
    forecastPoints: Array<{
      date: string
      value: number
    }>
    horizon: 3 | 6
    monthlySlope: number
    hasMixedSources: boolean
    hasRecordedDateFallback: boolean
    note: string
    runwaySeries?: Array<{
      variant: 'cash' | 'working_capital_adjusted'
      label: string
      actualPoints: Array<{
        date: string
        value: number
        sourceLabel: string
        confidence: number
      }>
      forecastPoints: Array<{ date: string; value: number }>
    }>
  }
}

export interface ScenarioComparisonWidget extends GenUiWidgetBase {
  type: 'scenario_comparison'
  data: {
    currency: 'NZD' | 'AUD'
    base: {
      label: string
      monthlyBurn: number | null
      runwayMonths: number | null
    }
    scenarios: Array<{
      label: string
      monthlyBurn: number | null
      runwayMonths: number | null
      deltaMonths: number | null
    }>
    note: string
  }
}

export interface ScenarioAnalysisWidget extends GenUiWidgetBase {
  type: 'scenario_analysis'
  data: {
    result: ScenarioAnalysisResult
    editHref: string
  }
}

export interface PlanningChecklistWidget extends GenUiWidgetBase {
  type: 'planning_checklist'
  data: {
    items: Array<{
      label: string
      detail: string
      tone: 'urgent' | 'watch' | 'steady'
    }>
  }
}

export interface RiskThresholdTimelineWidget extends GenUiWidgetBase {
  type: 'risk_threshold_timeline'
  data: {
    currentRunway: number | null
    workingCapitalAdjustedRunway?: number | null
    monthsUntilCaution: number | null
    monthsUntilUrgent: number | null
    status: 'urgent' | 'caution' | 'healthy' | 'unknown'
    message: string
  }
}

export interface MetricSourceEvidenceWidget extends GenUiWidgetBase {
  type: 'metric_source_evidence'
  data: {
    metrics: Array<{
      label: string
      value: string
      sourceLabel: string
      sourceType: string
      confidence: number | null
      tone: 'available' | 'unavailable' | 'derived'
      reportingDate?: string | null
      dateStatus?: GenUiMetricDateStatus
      calculationRole?: GenUiMetricCalculationRole
      detail?: string | null
    }>
  }
}

export interface MissingDataPanelWidget extends GenUiWidgetBase {
  type: 'missing_data_panel'
  data: {
    missingMetrics: string[]
    message: string
  }
}

export interface HighlightExplainerWidget extends GenUiWidgetBase {
  type: 'highlight_explainer'
  data: {
    selectedText: string
    prompt: string
  }
}

export type GenUiWidget =
  | MetricSnapshotWidget
  | DataConnectionsWidget
  | MetricTrendChartWidget
  | MetricForecastChartWidget
  | ScenarioComparisonWidget
  | ScenarioAnalysisWidget
  | PlanningChecklistWidget
  | RiskThresholdTimelineWidget
  | MetricSourceEvidenceWidget
  | MissingDataPanelWidget
  | HighlightExplainerWidget
  | CashBalanceWidget
  | RevenueSnapshotWidget
  | RevenueTrendWidget
  | RevenueGrowthWidget
  | ExpenseSummaryWidget
  | ExpenseTrendWidget
  | AccountsReceivableWidget
  | AccountsPayableWidget
  | AiFinancialBriefWidget
  | CashFlowSummaryWidget
  | CashFlowForecastWidget
  | RevenueForecastWidget
  | ProfitSnapshotWidget
  | ProfitTrendWidget
  | ProfitForecastWidget
  | ProfitMarginWidget
  | BreakEvenAnalysisWidget
  | BreakEvenProgressWidget
  | ExpenseBreakdownWidget
  | LargestExpensesWidget
  | ExpenseChangeDetectorWidget
  | BudgetVsActualWidget
  | BudgetRemainingWidget
  | BudgetForecastWidget
  | CashInflowForecastWidget
  | CashOutflowForecastWidget

export type GenUiWidgetByType = {
  [Type in GenUiWidgetType]: Extract<GenUiWidget, { type: Type }>
}

export interface GenUiPlan {
  version: typeof GEN_UI_PLAN_VERSION
  source: GenUiSource
  generatedAt: string
  summary: string
  widgets: GenUiWidget[]
  /** Optional for backward compatibility with plans saved before review mode. */
  workspaceMode?: 'financial' | 'document_review'
  /** Review state captured when a document-evidence answer was generated. */
  documentReviewSnapshot?: {
    documentIds: string[]
    statusAtGeneration: 'pending'
  }
}
