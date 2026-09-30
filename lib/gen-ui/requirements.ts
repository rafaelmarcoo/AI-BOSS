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
  'cash',
  'revenue',
  'expenses',
  'receivables',
  'payables',
  'brief',
  'profit',
  'budgets',
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
  'financial_statements',
  'cash_flow_history',
  'expense_categories',
  'expense_transactions',
  'budget_lines',
  'cost_classification',
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
  'thirty_days',
  'sixty_days',
  'ninety_days',
  'twelve_months',
] as const

export type GenUiSupportedPeriod = (typeof GEN_UI_SUPPORTED_PERIODS)[number]

export const GEN_UI_SUPPORTED_FILTERS = [
  'metric',
  'source',
  'scenario',
  'category',
  'profit_type',
  'budget',
] as const

export type GenUiSupportedFilter = (typeof GEN_UI_SUPPORTED_FILTERS)[number]

export interface GenUiDataRequirements {
  required: readonly GenUiDataCapability[]
  optional: readonly GenUiDataCapability[]
}
