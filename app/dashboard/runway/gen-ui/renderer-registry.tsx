"use client";

import type { ComponentType } from "react";
import type {
  GenUiWidgetByType,
  GenUiWidgetType,
} from "@/lib/gen-ui/types";
import type { GenUiWidgetInteractionProps } from "./types";
import { DataConnectionsWidgetView } from "./widgets/existing/DataConnectionsWidget";
import {
  MetricForecastChartWidgetView,
  MetricSnapshotWidgetView,
  MetricSourceEvidenceWidgetView,
  MetricTrendChartWidgetView,
} from "./widgets/existing/MetricWidgets";
import {
  HighlightExplainerWidgetView,
  MissingDataPanelWidgetView,
  PlanningChecklistWidgetView,
  RiskThresholdTimelineWidgetView,
} from "./widgets/existing/PlanningWidgets";
import {
  ScenarioAnalysisWidgetView,
  ScenarioComparisonWidgetView,
} from "./widgets/existing/ScenarioWidgets";

export type GenUiRendererProps<Type extends GenUiWidgetType> =
  GenUiWidgetInteractionProps & {
    widget: GenUiWidgetByType[Type];
  };

type GenUiRendererRegistry = {
  [Type in GenUiWidgetType]: ComponentType<GenUiRendererProps<Type>>;
};

export const GEN_UI_RENDERER_REGISTRY = {
  metric_snapshot: MetricSnapshotWidgetView,
  data_connections: DataConnectionsWidgetView,
  metric_trend_chart: MetricTrendChartWidgetView,
  metric_forecast_chart: MetricForecastChartWidgetView,
  scenario_comparison: ScenarioComparisonWidgetView,
  scenario_analysis: ScenarioAnalysisWidgetView,
  planning_checklist: PlanningChecklistWidgetView,
  risk_threshold_timeline: RiskThresholdTimelineWidgetView,
  metric_source_evidence: MetricSourceEvidenceWidgetView,
  missing_data_panel: MissingDataPanelWidgetView,
  highlight_explainer: HighlightExplainerWidgetView,
} satisfies GenUiRendererRegistry;
