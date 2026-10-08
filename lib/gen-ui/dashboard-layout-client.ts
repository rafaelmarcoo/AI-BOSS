import { GEN_UI_WIDGET_CATALOG } from '@/lib/gen-ui/catalog'
import {
  DASHBOARD_LAYOUT_VERSION,
  DEFAULT_DASHBOARD_RISK_THRESHOLDS,
  type DashboardForecastHorizon,
  type DashboardLayoutPayload,
  type DashboardLayoutWidget,
  type DashboardRiskThresholds,
} from '@/lib/gen-ui/dashboard-layout-types'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { GenUiPlan, GenUiWidget } from '@/lib/gen-ui/types'
import { uniqueWidgets } from '@/lib/gen-ui/unique-widgets'

const CONVERSATION_ONLY_WIDGETS = new Set([
  'scenario_comparison',
  'scenario_analysis',
  'highlight_explainer',
])

function uniqueId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return '00000000-0000-4000-8000-'.concat(
    Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12),
  )
}

function recordData(widget: GenUiWidget) {
  return widget.data as unknown as Record<string, unknown>
}

function metricKeys(widget: GenUiWidget): FinancialMetricKey[] {
  if (widget.type === 'metric_snapshot') {
    return [...new Set(widget.data.metrics.map((metric) => metric.key))]
  }
  if (
    widget.type === 'metric_trend_chart' ||
    widget.type === 'metric_forecast_chart'
  ) {
    return [widget.data.metricKey]
  }
  return []
}

function forecastHorizon(widget: GenUiWidget): DashboardForecastHorizon | null {
  const data = recordData(widget)
  const value = data.horizon ?? data.horizonDays ?? data.horizonMonths
  return [3, 6, 12, 30, 60, 90].includes(Number(value))
    ? (Number(value) as DashboardForecastHorizon)
    : GEN_UI_WIDGET_CATALOG[widget.type].requiresForecast
      ? 3
      : null
}

function currency(widget: GenUiWidget) {
  const data = recordData(widget)
  if (typeof data.currency === 'string') return data.currency
  if (Array.isArray(data.groups)) {
    const first = data.groups[0]
    if (first && typeof first === 'object' && 'currency' in first) {
      const value = (first as { currency?: unknown }).currency
      return typeof value === 'string' ? value : null
    }
  }
  return null
}

export function createDashboardLayoutWidget(
  widgetType: GenUiWidget['type'],
  source?: GenUiWidget,
): DashboardLayoutWidget {
  const catalog = GEN_UI_WIDGET_CATALOG[widgetType]
  const defaultForecastHorizon: DashboardForecastHorizon | null =
    widgetType === 'cash_flow_forecast'
      ? 30
      : widgetType === 'debt_repayment_timeline'
        ? 6
        : catalog.requiresForecast
          ? 3
          : null
  return {
    id: uniqueId(),
    widgetType,
    title: source?.title ?? null,
    reason: source?.reason ?? null,
    size: catalog.defaultSize,
    isPinned: false,
    isHidden: false,
    period: catalog.supportedPeriods[0] ?? null,
    forecastHorizon: source ? forecastHorizon(source) : defaultForecastHorizon,
    currency: source ? currency(source) : null,
    metricKeys: source ? metricKeys(source) : [],
  }
}

export function dashboardPayloadFromPlan(
  plan: GenUiPlan | null,
  riskThresholds: DashboardRiskThresholds = DEFAULT_DASHBOARD_RISK_THRESHOLDS,
): DashboardLayoutPayload {
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    widgets: uniqueWidgets(plan?.widgets ?? [])
      .filter((widget) => !CONVERSATION_ONLY_WIDGETS.has(widget.type))
      .map((widget) => createDashboardLayoutWidget(widget.type, widget)),
    riskThresholds: { ...riskThresholds },
  }
}
