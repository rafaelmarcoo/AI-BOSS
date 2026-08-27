import type { GenUiWidgetType } from '@/lib/gen-ui/types'

export interface GenUiWidgetCatalogEntry {
  type: GenUiWidgetType
  label: string
  description: string
  selectionGuidance: string
  defaultColumnSpan: 1 | 2
}

export const GEN_UI_WIDGET_CATALOG = {
  metric_snapshot: {
    type: 'metric_snapshot',
    label: 'Metric snapshot',
    description: 'A focused set of live financial metrics and their sources.',
    selectionGuidance: 'Select only the metric keys directly relevant to the question.',
    defaultColumnSpan: 2,
  },
  data_connections: {
    type: 'data_connections',
    label: 'Document sources',
    description: 'Supported uploaded financial files and review availability.',
    selectionGuidance: 'Select for document, file upload, or source-review questions.',
    defaultColumnSpan: 2,
  },
  metric_trend_chart: {
    type: 'metric_trend_chart',
    label: 'Historical metric trend',
    description: 'Shows deterministic historical movement for one financial metric.',
    selectionGuidance: 'Select only for a historical question that names one metric such as cash, revenue, expenses, burn rate, or runway.',
    defaultColumnSpan: 2,
  },
  metric_forecast_chart: {
    type: 'metric_forecast_chart',
    label: 'Metric forecast',
    description: 'Shows deterministic actual and projected movement for one financial metric.',
    selectionGuidance: 'Select only for a future-focused question that names cash, revenue, expenses, burn rate, or runway.',
    defaultColumnSpan: 2,
  },
  scenario_comparison: {
    type: 'scenario_comparison',
    label: 'Scenario comparison',
    description: 'Compares the current runway with modeled burn changes.',
    selectionGuidance: 'Select for what-if, hiring, saving, or cost-change questions.',
    defaultColumnSpan: 1,
  },
  scenario_analysis: {
    type: 'scenario_analysis',
    label: 'Scenario analysis',
    description: 'Shows the exact deterministic current-run-rate and historical-trend scenario result.',
    selectionGuidance: 'Use only when the model_scenario tool returned a ready structured result.',
    defaultColumnSpan: 2,
  },
  planning_checklist: {
    type: 'planning_checklist',
    label: 'Planning checklist',
    description: 'Prioritized actions based on current runway conditions.',
    selectionGuidance: 'Select when the user needs concrete next steps.',
    defaultColumnSpan: 1,
  },
  risk_threshold_timeline: {
    type: 'risk_threshold_timeline',
    label: 'Risk threshold timing',
    description: 'Shows current runway risk and time to caution or urgent thresholds.',
    selectionGuidance: 'Select for runway risk, timing, or buffer questions.',
    defaultColumnSpan: 1,
  },
  metric_source_evidence: {
    type: 'metric_source_evidence',
    label: 'Metric source evidence',
    description: 'Displays the values and provenance supporting the answer.',
    selectionGuidance: 'Select for source, evidence, uploaded-data, or metric questions.',
    defaultColumnSpan: 2,
  },
  missing_data_panel: {
    type: 'missing_data_panel',
    label: 'Missing data',
    description: 'Explains which required financial inputs are unavailable.',
    selectionGuidance: 'Select when missing inputs materially limit the answer.',
    defaultColumnSpan: 1,
  },
  highlight_explainer: {
    type: 'highlight_explainer',
    label: 'Highlighted insight',
    description: 'Connects selected workspace text to a focused follow-up question.',
    selectionGuidance: 'Select when the request originated from highlighted workspace text.',
    defaultColumnSpan: 2,
  },
} as const satisfies Record<GenUiWidgetType, GenUiWidgetCatalogEntry>

export const GEN_UI_WIDGET_CATALOG_ENTRIES = Object.values(
  GEN_UI_WIDGET_CATALOG,
)

export function describeGenUiWidgetCatalog() {
  return GEN_UI_WIDGET_CATALOG_ENTRIES.map(
    ({ type, selectionGuidance }) => `${type}: ${selectionGuidance}`,
  ).join('\n')
}
