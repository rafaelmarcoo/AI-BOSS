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
} satisfies GenUiBuilderRegistry;

export function buildGenUiWidgets(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
) {
  return GEN_UI_BUILDER_REGISTRY[spec.type](spec, index, context);
}

