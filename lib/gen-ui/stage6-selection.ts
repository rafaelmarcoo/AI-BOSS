import { GEN_UI_WIDGET_CATALOG } from '@/lib/gen-ui/catalog'
import type { PlannerWidget } from '@/lib/gen-ui/builders/types'
import type { GenUiWidgetType } from '@/lib/gen-ui/types'

function candidate(type: GenUiWidgetType) {
  const entry = GEN_UI_WIDGET_CATALOG[type]
  return {
    id: `stage6_${type}`,
    type,
    label: entry.label,
    description: entry.description,
    selectionGuidance: entry.selectionGuidance,
    redundancyGroup: `stage6-${type}`,
  }
}

export function selectStage6FallbackSpecs(userMessage: string): PlannerWidget[] {
  const message = userMessage.toLowerCase()
  const specs: PlannerWidget[] = []
  if (/\b(customer|client)\b.*\b(concentration|dependency|dependence|dependent|risk)\b|\b(concentration|dependency|dependence|dependent)\b.*\b(customer|client|revenue)\b/.test(message)) {
    specs.push({ type: 'customer_concentration_risk' })
  } else if (/\b(top|major|largest|best)\b.*\b(customers?|clients?)\b|\b(customer|client)\s+revenue\b|\brevenue\b.*\b(customers?|clients?)\b/.test(message)) {
    specs.push({ type: 'customer_revenue_breakdown' })
  }
  if (/\brevenue\b.*\b(products?|services?|subscriptions?|departments?|business units?|divisions?|tracking categor(?:y|ies))\b|\b(products?|services?|subscriptions?|departments?|business units?|divisions?)\b.*\brevenue\b/.test(message)) {
    specs.push({ type: 'product_service_revenue' })
  }
  return specs
}

export function listStage6WidgetCandidates(userMessage: string) {
  return selectStage6FallbackSpecs(userMessage).map((spec) => candidate(spec.type))
}
