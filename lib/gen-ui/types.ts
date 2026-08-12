import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'

export const GEN_UI_PLAN_VERSION = 1

export const GEN_UI_WIDGET_TYPES = [
  'metric_snapshot',
  'data_connections',
  'metric_trend_chart',
  'metric_forecast_chart',
  'scenario_comparison',
  'planning_checklist',
  'risk_threshold_timeline',
  'metric_source_evidence',
  'missing_data_panel',
  'highlight_explainer',
] as const

export type GenUiWidgetType = (typeof GEN_UI_WIDGET_TYPES)[number]

export type GenUiSource = 'chat' | 'selection'

export interface GenUiWidgetBase {
  id: string
  type: GenUiWidgetType
  title: string
  reason: string
}

export interface MetricSnapshotWidget extends GenUiWidgetBase {
  type: 'metric_snapshot'
  data: {
    metrics: Array<{
      key: FinancialMetricKey
      label: string
      value: string
      unit: string | null
      sourceLabel: string
      sourceTone: 'available' | 'unavailable' | 'derived'
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
  }
}

export interface ScenarioComparisonWidget extends GenUiWidgetBase {
  type: 'scenario_comparison'
  data: {
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
  | PlanningChecklistWidget
  | RiskThresholdTimelineWidget
  | MetricSourceEvidenceWidget
  | MissingDataPanelWidget
  | HighlightExplainerWidget

export interface GenUiPlan {
  version: typeof GEN_UI_PLAN_VERSION
  source: GenUiSource
  generatedAt: string
  summary: string
  widgets: GenUiWidget[]
}
