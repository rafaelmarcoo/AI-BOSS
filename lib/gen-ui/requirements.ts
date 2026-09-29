export const GEN_UI_WIDGET_CATEGORIES = [
  'overview',
  'connections',
  'trends',
  'forecasting',
  'scenarios',
  'planning',
  'risk',
  'evidence',
  'data_quality',
  'explanation',
] as const

export type GenUiWidgetCategory = (typeof GEN_UI_WIDGET_CATEGORIES)[number]

export const GEN_UI_DATA_CAPABILITIES = [
  'aggregate_metrics',
  'metric_history',
  'metric_forecast',
  'runway_trend',
  'scenario_result',
  'document_sources',
  'selection_context',
] as const

export type GenUiDataCapability = (typeof GEN_UI_DATA_CAPABILITIES)[number]

export const GEN_UI_SUPPORTED_PERIODS = [
  'current',
  'month',
  'quarter',
  'year',
  'three_months',
  'six_months',
  'all_history',
] as const

export type GenUiSupportedPeriod = (typeof GEN_UI_SUPPORTED_PERIODS)[number]

export const GEN_UI_SUPPORTED_FILTERS = [
  'metric',
  'source',
  'scenario',
] as const

export type GenUiSupportedFilter = (typeof GEN_UI_SUPPORTED_FILTERS)[number]

export interface GenUiDataRequirements {
  required: readonly GenUiDataCapability[]
  optional: readonly GenUiDataCapability[]
}
