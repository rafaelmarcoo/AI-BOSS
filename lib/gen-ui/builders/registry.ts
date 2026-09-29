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
} satisfies GenUiBuilderRegistry;

export function buildGenUiWidgets(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
) {
  return GEN_UI_BUILDER_REGISTRY[spec.type](spec, index, context);
}
