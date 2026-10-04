import 'server-only'

import {
  HISTORICAL_METRIC_KEYS,
  readFinancialMetricHistorySeries,
  type HistoricalMetricKey,
} from '@/lib/financial-data/metric-history'
import { readFinancialMetricForecastSeries } from '@/lib/financial-data/metric-forecast'
import { isSupportedFinancialCurrency } from '@/lib/financial-data/currency'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import { readRunwayObservationHistory } from '@/lib/financial-data/runway-history'
import {
  EMPTY_STAGE3_FINANCIAL_DATA,
  readStage3FinancialData,
} from '@/lib/financial-data/reporting/read-service'
import type { Stage3FinancialData } from '@/lib/financial-data/reporting/types'
import { buildGenUiWidgets } from '@/lib/gen-ui/builders/registry'
import type { PlannerWidget } from '@/lib/gen-ui/builders/types'
import type {
  HydratedDashboardLayout,
  HydratedDashboardWidget,
  DashboardLayoutPayload,
  DashboardLayoutWidget,
} from '@/lib/gen-ui/dashboard-layout-types'
import type { GenUiSupportedPeriod } from '@/lib/gen-ui/requirements'
import type { GenUiWidget } from '@/lib/gen-ui/types'

const TREND_METRIC_BY_TYPE = {
  revenue_trend: 'monthly_revenue',
  revenue_growth: 'monthly_revenue',
  revenue_forecast: 'monthly_revenue',
  expense_trend: 'monthly_expenses',
} as const

function rangeForPeriod(period: GenUiSupportedPeriod | null) {
  if (period === 'three_months') return '3m' as const
  if (period === 'six_months') return '6m' as const
  return 'all' as const
}

function startDateForPeriod(period: GenUiSupportedPeriod | null) {
  if (!period || period === 'current' || period === 'all_history') return null
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  if (period === 'month') return start.toISOString().slice(0, 10)
  if (period === 'quarter') {
    start.setUTCMonth(Math.floor(now.getUTCMonth() / 3) * 3)
    return start.toISOString().slice(0, 10)
  }
  if (period === 'year') {
    start.setUTCMonth(0)
    return start.toISOString().slice(0, 10)
  }
  if (period === 'three_months') start.setUTCMonth(start.getUTCMonth() - 2)
  else if (period === 'six_months') start.setUTCMonth(start.getUTCMonth() - 5)
  else if (period === 'twelve_months') start.setUTCMonth(start.getUTCMonth() - 11)
  else return null

  return start.toISOString().slice(0, 10)
}

function overlaps(start: string, end: string, minimum: string | null) {
  return minimum === null || end >= minimum || start >= minimum
}

function filterStage3Data(
  data: Stage3FinancialData,
  item: DashboardLayoutWidget,
): Stage3FinancialData {
  const currency = item.currency
  const minimum = startDateForPeriod(item.period)
  const matchesCurrency = (value: { currency: string }) =>
    currency === null || value.currency === currency

  return {
    capabilities: data.capabilities,
    accounts: data.accounts,
    reportingPeriods: data.reportingPeriods.filter(
      (value) =>
        matchesCurrency(value) &&
        overlaps(value.period_start, value.period_end, minimum),
    ),
    transactions: data.transactions.filter(
      (value) =>
        matchesCurrency(value) &&
        (minimum === null || value.transaction_date >= minimum),
    ),
    budgets: data.budgets.filter(
      (value) =>
        matchesCurrency(value) &&
        overlaps(value.period_start, value.period_end, minimum),
    ),
    invoices: data.invoices.filter((value) => matchesCurrency(value)),
    debts: data.debts.filter((value) => matchesCurrency(value)),
    revenueEntries: data.revenueEntries.filter(
      (value) =>
        matchesCurrency(value) &&
        (minimum === null || value.revenue_date >= minimum),
    ),
  }
}

function periodText(period: GenUiSupportedPeriod | null) {
  return period?.replaceAll('_', ' ') ?? 'current period'
}

function horizonText(item: DashboardLayoutWidget) {
  if (item.forecastHorizon === null) return ''
  const unit = item.forecastHorizon >= 30 ? 'days' : 'months'
  return `${item.forecastHorizon} ${unit}`
}

function hydrationMessage(item: DashboardLayoutWidget) {
  return [
    `Show ${item.widgetType.replaceAll('_', ' ')}.`,
    `Use ${periodText(item.period)}.`,
    item.forecastHorizon === null
      ? ''
      : `Use a ${horizonText(item)} forecast horizon.`,
    item.currency === null ? '' : `Use ${item.currency} only.`,
    item.metricKeys.length === 0
      ? ''
      : `Metrics: ${item.metricKeys.join(', ')}.`,
  ]
    .filter(Boolean)
    .join(' ')
}

function historicalKeysForItem(item: DashboardLayoutWidget) {
  const keys = new Set(item.metricKeys)
  const mapped = TREND_METRIC_BY_TYPE[
    item.widgetType as keyof typeof TREND_METRIC_BY_TYPE
  ]
  if (mapped) keys.add(mapped)
  if (item.widgetType === 'metric_trend_chart' && keys.size === 0) keys.add('cash')
  if (item.widgetType === 'metric_forecast_chart' && keys.size === 0) keys.add('cash')
  return [...keys].filter(
    (key): key is HistoricalMetricKey =>
      HISTORICAL_METRIC_KEYS.includes(key as HistoricalMetricKey),
  )
}

function widgetCurrencies(widget: GenUiWidget) {
  const data = widget.data as unknown as Record<string, unknown>
  const currencies = new Set<string>()
  if (typeof data.currency === 'string') currencies.add(data.currency)
  if (Array.isArray(data.groups)) {
    data.groups.forEach((group) => {
      if (group && typeof group === 'object' && 'currency' in group) {
        const currency = (group as { currency?: unknown }).currency
        if (typeof currency === 'string') currencies.add(currency)
      }
    })
  }
  return [...currencies]
}

function enforceSelectedCurrency(
  widget: GenUiWidget,
  currency: string | null,
): GenUiWidget {
  if (!currency) return widget
  const currencies = widgetCurrencies(widget)
  if (currencies.length === 0 || currencies.includes(currency)) return widget
  return {
    ...widget,
    state: {
      status: 'unavailable',
      message: `No trusted ${currency} data is available for this widget. No currency conversion was performed.`,
    },
  }
}

function listAvailableCurrencies(
  data: Stage3FinancialData,
  widgets: DashboardLayoutWidget[],
  snapshot: Awaited<ReturnType<typeof readSourceAwareMetrics>>,
) {
  const currencies = new Set<string>()
  for (const collection of [
    data.reportingPeriods,
    data.transactions,
    data.budgets,
    data.invoices,
    data.debts,
    data.revenueEntries,
  ]) {
    collection.forEach((value) => currencies.add(value.currency))
  }
  widgets.forEach((widget) => {
    if (widget.currency) currencies.add(widget.currency)
  })
  Object.values(snapshot.metrics).forEach((metric) => {
    if (metric.status === 'available' && metric.currency) {
      currencies.add(metric.currency)
    }
  })
  return [...currencies].sort()
}

export async function hydrateDashboardLayout(
  userId: string,
  payload: DashboardLayoutPayload,
): Promise<HydratedDashboardLayout> {
  const [snapshot, runwayTrend, stage3Data] = await Promise.all([
    readSourceAwareMetrics(userId),
    readRunwayObservationHistory(userId).catch(() => ({
      observations: [],
      direction: 'insufficient_data' as const,
      change: null,
      averageChange: null,
      workingCapitalAdjusted: {
        observations: [],
        direction: 'insufficient_data' as const,
        change: null,
        averageChange: null,
      },
    })),
    readStage3FinancialData(userId).catch(() => EMPTY_STAGE3_FINANCIAL_DATA),
  ])

  const items = await Promise.all(
    payload.widgets.map(async (item, index): Promise<HydratedDashboardWidget> => {
      try {
        const historicalKeys = historicalKeysForItem(item)
        const currency =
          item.currency && isSupportedFinancialCurrency(item.currency)
            ? item.currency
            : null
        const historyCollections = await Promise.all(
          historicalKeys.map((metricKey) =>
            readFinancialMetricHistorySeries({
              userId,
              metricKey,
              range: rangeForPeriod(item.period),
              recordLimit: 'all',
              currency,
            }).catch(() => null),
          ),
        )
        const needsForecast =
          item.widgetType === 'metric_forecast_chart' ||
          item.widgetType === 'revenue_forecast'
        const forecastCollections = needsForecast
          ? await Promise.all(
              historicalKeys.map((metricKey) =>
                readFinancialMetricForecastSeries({
                  userId,
                  metricKey,
                  range: rangeForPeriod(item.period),
                  horizon: item.forecastHorizon === 6 ? 6 : 3,
                  recordLimit: 'all',
                  currency,
                }).catch(() => null),
              ),
            )
          : []

        const spec: PlannerWidget = {
          type: item.widgetType,
          ...(item.title ? { title: item.title } : {}),
          ...(item.reason ? { reason: item.reason } : {}),
          ...(item.metricKeys.length > 0 ? { metricKeys: item.metricKeys } : {}),
        }
        const built = buildGenUiWidgets(spec, index, {
          snapshot,
          runwayTrend,
          source: 'chat',
          selectedText: null,
          userMessage: hydrationMessage(item),
          metricHistories: historyCollections.flatMap(
            (collection) => collection?.series ?? [],
          ),
          metricForecasts: forecastCollections.flatMap(
            (collection) => collection?.series ?? [],
          ),
          scenarioResult: null,
          stage3Data: filterStage3Data(stage3Data, item),
          riskThresholds: payload.riskThresholds,
        })
        const widget = built[0]
          ? enforceSelectedCurrency({ ...built[0], id: item.id }, item.currency)
          : null
        return {
          itemId: item.id,
          widget,
          error: widget ? null : 'This widget needs conversation-only context.',
        }
      } catch (error) {
        console.error(`Could not hydrate dashboard widget ${item.widgetType}.`, error)
        return {
          itemId: item.id,
          widget: null,
          error: 'This widget could not be refreshed from the current data.',
        }
      }
    }),
  )

  return {
    items,
    availableCurrencies: listAvailableCurrencies(
      stage3Data,
      payload.widgets,
      snapshot,
    ),
  }
}
