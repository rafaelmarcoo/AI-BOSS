import type { GenUiWidget, GenUiWidgetType } from "@/lib/gen-ui/types";
import {
  buildDataConnectionsWidget,
  buildMetricForecastWidget,
  buildMetricSnapshotWidget,
  buildMetricSourceEvidenceWidget,
  buildMetricTrendWidget,
} from "./existing/metric-builders";
import {
  buildHighlightExplainerWidget,
  buildMissingDataPanelWidget,
  buildPlanningChecklistWidget,
  buildRiskThresholdTimelineWidget,
} from "./existing/planning-builders";
import { buildScenarioAnalysisWidget } from "./existing/scenario-builders";
import {
  buildAccountsPayableWidget,
  buildAccountsReceivableWidget,
  buildAiFinancialBriefWidget,
  buildCashBalanceWidget,
  buildExpenseSummaryWidget,
  buildExpenseTrendWidgets,
  buildRevenueGrowthWidget,
  buildRevenueSnapshotWidget,
  buildRevenueTrendWidgets,
} from "./existing-data/existing-data-builders";
import type { GenUiDataContext, PlannerWidget } from "./types";
import {
  buildBreakEvenAnalysisWidget,
  buildBreakEvenProgressWidget,
  buildBudgetForecastWidget,
  buildBudgetRemainingWidget,
  buildBudgetVsActualWidget,
  buildCashFlowForecastWidget,
  buildCashFlowSummaryWidget,
  buildCashInflowForecastWidget,
  buildCashOutflowForecastWidget,
  buildExpenseBreakdownWidget,
  buildExpenseChangeDetectorWidget,
  buildLargestExpensesWidget,
  buildProfitForecastWidget,
  buildProfitMarginWidget,
  buildProfitSnapshotWidget,
  buildProfitTrendWidget,
  buildRevenueForecastWidget,
} from "./stage3/stage3-builders";
import {
  buildBillsDueWidget,
  buildExpectedPaymentsWidget,
  buildInvoiceAgeingWidget,
  buildOverdueInvoicesWidget,
} from "./stage4/stage4-builders";
import {
  buildAssetSummaryWidget,
  buildCurrentRatioWidget,
  buildDebtOverviewWidget,
  buildDebtRepaymentTimelineWidget,
  buildEquitySnapshotWidget,
  buildLiabilitySummaryWidget,
  buildQuickRatioWidget,
  buildWorkingCapitalWidget,
} from "./stage5/stage5-builders";

export type GenUiWidgetBuilder = (
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
) => GenUiWidget[];

type GenUiBuilderRegistry = Record<GenUiWidgetType, GenUiWidgetBuilder>;

function optionalWidget(widget: GenUiWidget | null) {
  return widget ? [widget] : [];
}

export const GEN_UI_BUILDER_REGISTRY = {
  metric_snapshot: (spec, index, context) => [
    buildMetricSnapshotWidget(spec, index, context),
  ],
  data_connections: (spec, index) => [
    buildDataConnectionsWidget(spec, index),
  ],
  metric_trend_chart: (spec, index, context) =>
    context.metricHistories.flatMap((history, seriesIndex) =>
      optionalWidget(
        buildMetricTrendWidget(spec, index * 10 + seriesIndex, context, history),
      ),
    ),
  metric_forecast_chart: (spec, index, context) =>
    context.metricForecasts.flatMap((forecast, seriesIndex) =>
      optionalWidget(
        buildMetricForecastWidget(
          spec,
          index * 10 + seriesIndex,
          context,
          forecast,
        ),
      ),
    ),
  // Persisted legacy plans can still render this type, but new plans must use
  // the exact deterministic scenario tool result represented below.
  scenario_comparison: () => [],
  scenario_analysis: (spec, index, context) =>
    optionalWidget(buildScenarioAnalysisWidget(spec, index, context)),
  planning_checklist: (spec, index, context) => [
    buildPlanningChecklistWidget(spec, index, context),
  ],
  risk_threshold_timeline: (spec, index, context) => [
    buildRiskThresholdTimelineWidget(spec, index, context),
  ],
  metric_source_evidence: (spec, index, context) => [
    buildMetricSourceEvidenceWidget(spec, index, context),
  ],
  missing_data_panel: (spec, index, context) =>
    optionalWidget(buildMissingDataPanelWidget(spec, index, context)),
  highlight_explainer: (spec, index, context) => [
    buildHighlightExplainerWidget(spec, index, context),
  ],
  cash_balance: (spec, index, context) => [
    buildCashBalanceWidget(spec, index, context),
  ],
  revenue_snapshot: (spec, index, context) => [
    buildRevenueSnapshotWidget(spec, index, context),
  ],
  revenue_trend: buildRevenueTrendWidgets,
  revenue_growth: (spec, index, context) => [
    buildRevenueGrowthWidget(spec, index, context),
  ],
  expense_summary: (spec, index, context) => [
    buildExpenseSummaryWidget(spec, index, context),
  ],
  expense_trend: buildExpenseTrendWidgets,
  accounts_receivable: (spec, index, context) => [
    buildAccountsReceivableWidget(spec, index, context),
  ],
  accounts_payable: (spec, index, context) => [
    buildAccountsPayableWidget(spec, index, context),
  ],
  ai_financial_brief: (spec, index, context) => [
    buildAiFinancialBriefWidget(spec, index, context),
  ],
  cash_flow_summary: (spec, index, context) => [buildCashFlowSummaryWidget(spec, index, context)],
  cash_flow_forecast: (spec, index, context) => [buildCashFlowForecastWidget(spec, index, context)],
  revenue_forecast: (spec, index, context) => [buildRevenueForecastWidget(spec, index, context)],
  profit_snapshot: (spec, index, context) => [buildProfitSnapshotWidget(spec, index, context)],
  profit_trend: (spec, index, context) => [buildProfitTrendWidget(spec, index, context)],
  profit_forecast: (spec, index, context) => [buildProfitForecastWidget(spec, index, context)],
  profit_margin: (spec, index, context) => [buildProfitMarginWidget(spec, index, context)],
  break_even_analysis: (spec, index, context) => [buildBreakEvenAnalysisWidget(spec, index, context)],
  break_even_progress: (spec, index, context) => [buildBreakEvenProgressWidget(spec, index, context)],
  expense_breakdown: (spec, index, context) => [buildExpenseBreakdownWidget(spec, index, context)],
  largest_expenses: (spec, index, context) => [buildLargestExpensesWidget(spec, index, context)],
  expense_change_detector: (spec, index, context) => [buildExpenseChangeDetectorWidget(spec, index, context)],
  budget_vs_actual: (spec, index, context) => [buildBudgetVsActualWidget(spec, index, context)],
  budget_remaining: (spec, index, context) => [buildBudgetRemainingWidget(spec, index, context)],
  budget_forecast: (spec, index, context) => [buildBudgetForecastWidget(spec, index, context)],
  cash_inflow_forecast: (spec, index, context) => [buildCashInflowForecastWidget(spec, index, context)],
  cash_outflow_forecast: (spec, index, context) => [buildCashOutflowForecastWidget(spec, index, context)],
  overdue_invoices: (spec, index, context) => [buildOverdueInvoicesWidget(spec, index, context)],
  invoice_ageing: (spec, index, context) => [buildInvoiceAgeingWidget(spec, index, context)],
  expected_payments: (spec, index, context) => [buildExpectedPaymentsWidget(spec, index, context)],
  bills_due: (spec, index, context) => [buildBillsDueWidget(spec, index, context)],
  working_capital: (spec, index, context) => [buildWorkingCapitalWidget(spec, index, context)],
  current_ratio: (spec, index, context) => [buildCurrentRatioWidget(spec, index, context)],
  quick_ratio: (spec, index, context) => [buildQuickRatioWidget(spec, index, context)],
  asset_summary: (spec, index, context) => [buildAssetSummaryWidget(spec, index, context)],
  liability_summary: (spec, index, context) => [buildLiabilitySummaryWidget(spec, index, context)],
  equity_snapshot: (spec, index, context) => [buildEquitySnapshotWidget(spec, index, context)],
  debt_overview: (spec, index, context) => [buildDebtOverviewWidget(spec, index, context)],
  debt_repayment_timeline: (spec, index, context) => [buildDebtRepaymentTimelineWidget(spec, index, context)],
} satisfies GenUiBuilderRegistry;

export function buildGenUiWidgets(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
) {
  return GEN_UI_BUILDER_REGISTRY[spec.type](spec, index, context);
}
