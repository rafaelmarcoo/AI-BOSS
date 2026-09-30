import type { FinancialMetricKey } from "@/lib/financial-data/metric-keys";
import type { MetricForecastSummary } from "@/lib/financial-data/metric-forecast";
import type { MetricHistorySummary } from "@/lib/financial-data/metric-history";
import type { SourceAwareMetricReadResult } from "@/lib/financial-data/read-model";
import type { RunwayTrendSummary } from "@/lib/financial-data/runway-history";
import type { ScenarioAnalysisResult } from "@/lib/scenarios/calculation";
import type { GenUiSource, GenUiWidgetType } from "@/lib/gen-ui/types";
import type { Stage3FinancialData } from "@/lib/financial-data/reporting/types";

export interface PlannerWidget {
  type: GenUiWidgetType;
  title?: string;
  reason?: string;
  metricKeys?: FinancialMetricKey[];
}

export interface GenUiDataContext {
  snapshot: SourceAwareMetricReadResult;
  runwayTrend: RunwayTrendSummary;
  source: GenUiSource;
  selectedText: string | null;
  userMessage: string;
  metricHistories: MetricHistorySummary[];
  metricForecasts: MetricForecastSummary[];
  scenarioResult: ScenarioAnalysisResult | null;
  stage3Data: Stage3FinancialData;
}
