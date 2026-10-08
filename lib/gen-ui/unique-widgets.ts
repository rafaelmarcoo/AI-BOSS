import type { GenUiWidgetType } from '@/lib/gen-ui/types'
import type { DashboardLayoutWidget } from '@/lib/gen-ui/dashboard-layout-types'

type WidgetLike = {
  type: GenUiWidgetType
  data?: unknown
}

function dataRecord(widget: WidgetLike) {
  return widget.data && typeof widget.data === 'object'
    ? widget.data as Record<string, unknown>
    : null
}

function generatedWidgetIdentity(widget: WidgetLike) {
  const data = dataRecord(widget)
  const metricKeys = data && Array.isArray(data.metrics)
    ? data.metrics
      .flatMap((metric) => metric && typeof metric === 'object' && 'key' in metric
        ? [String((metric as { key: unknown }).key)]
        : [])
      .sort()
      .join(',')
    : ''

  return [
    widget.type,
    data?.metricKey ?? '',
    data?.currency ?? '',
    data?.horizon ?? data?.horizonDays ?? data?.horizonMonths ?? '',
    metricKeys,
  ].join('|')
}

/** Remove only cards that would show the same configured information. */
export function uniqueWidgets<T extends WidgetLike>(widgets: T[]): T[] {
  const seen = new Set<string>()
  return widgets.filter((widget) => {
    const identity = generatedWidgetIdentity(widget)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export function dashboardWidgetIdentity(widget: DashboardLayoutWidget) {
  return [
    widget.widgetType,
    widget.currency ?? '',
    widget.period ?? '',
    widget.forecastHorizon ?? '',
    [...widget.metricKeys].sort().join(','),
  ].join('|')
}
