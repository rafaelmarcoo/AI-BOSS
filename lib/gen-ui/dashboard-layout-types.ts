import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import type { GenUiSupportedPeriod } from '@/lib/gen-ui/requirements'
import type { GenUiWidgetSize } from '@/lib/gen-ui/catalog'
import type { GenUiWidget, GenUiWidgetType } from '@/lib/gen-ui/types'

export const DASHBOARD_LAYOUT_VERSION = 1
export const MAX_DASHBOARD_LAYOUT_WIDGETS = 20

export const DASHBOARD_FORECAST_HORIZONS = [
  3,
  6,
  12,
  30,
  60,
  90,
] as const

export type DashboardForecastHorizon =
  (typeof DASHBOARD_FORECAST_HORIZONS)[number]

export interface DashboardRiskThresholds {
  runwayCautionMonths: number
  runwayUrgentMonths: number
  customerTopOneElevatedPercent: number
  customerTopOneHighPercent: number
  customerTopThreeElevatedPercent: number
  customerTopThreeHighPercent: number
}

export const DEFAULT_DASHBOARD_RISK_THRESHOLDS: DashboardRiskThresholds = {
  runwayCautionMonths: 6,
  runwayUrgentMonths: 3,
  customerTopOneElevatedPercent: 30,
  customerTopOneHighPercent: 50,
  customerTopThreeElevatedPercent: 60,
  customerTopThreeHighPercent: 80,
}

export interface DashboardLayoutWidget {
  id: string
  widgetType: GenUiWidgetType
  title: string | null
  reason: string | null
  size: GenUiWidgetSize
  isPinned: boolean
  isHidden: boolean
  period: GenUiSupportedPeriod | null
  forecastHorizon: DashboardForecastHorizon | null
  currency: string | null
  metricKeys: FinancialMetricKey[]
}

export interface DashboardLayoutPayload {
  version: typeof DASHBOARD_LAYOUT_VERSION
  widgets: DashboardLayoutWidget[]
  riskThresholds: DashboardRiskThresholds
}

export interface SavedDashboardLayout {
  id: string
  name: string
  isDefault: boolean
  sourcePlanVersion: number | null
  sourceGeneratedAt: string | null
  payload: DashboardLayoutPayload
  createdAt: string
  updatedAt: string
}

export interface HydratedDashboardWidget {
  itemId: string
  widget: GenUiWidget | null
  error: string | null
}

export interface HydratedDashboardLayout {
  items: HydratedDashboardWidget[]
  availableCurrencies: string[]
}
