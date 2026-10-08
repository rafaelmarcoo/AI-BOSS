import type { GenUiWidgetType } from '@/lib/gen-ui/types'

/** Keep one card of each type in the current dashboard, not across chat turns. */
export function uniqueWidgets<T extends { type: GenUiWidgetType }>(widgets: T[]): T[] {
  const seen = new Set<GenUiWidgetType>()
  return widgets.filter((widget) => {
    if (seen.has(widget.type)) return false
    seen.add(widget.type)
    return true
  })
}
