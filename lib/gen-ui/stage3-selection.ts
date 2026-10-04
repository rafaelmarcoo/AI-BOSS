import { GEN_UI_WIDGET_CATALOG } from '@/lib/gen-ui/catalog'
import type { PlannerWidget } from '@/lib/gen-ui/builders/types'
import type { GenUiWidgetType } from '@/lib/gen-ui/types'

export interface Stage3WidgetCandidate {
  id: string
  type: GenUiWidgetType
  label: string
  description: string
  selectionGuidance: string
  redundancyGroup: string
}

function candidate(type: GenUiWidgetType, redundancyGroup: string): Stage3WidgetCandidate {
  const entry = GEN_UI_WIDGET_CATALOG[type]
  return { id: `stage3_${type}`, type, label: entry.label, description: entry.description, selectionGuidance: entry.selectionGuidance, redundancyGroup }
}

export function selectStage3FallbackSpecs(userMessage: string): PlannerWidget[] {
  const message = userMessage.toLowerCase()
  const specs: PlannerWidget[] = []
  const forecast = /\b(forecast|future|project|expected|next)\b/.test(message)

  if (/\bcash\s+inflows?\b/.test(message) && forecast) specs.push({ type: 'cash_inflow_forecast' })
  else if (/\bcash\s+outflows?\b/.test(message) && forecast) specs.push({ type: 'cash_outflow_forecast' })
  else if (/\bcash\s*flow\b/.test(message)) specs.push({ type: forecast ? 'cash_flow_forecast' : 'cash_flow_summary' })

  if (/\b(revenue|income)\b/.test(message) && forecast) specs.push({ type: 'revenue_forecast' })

  if (/\bprofit\s+margin|margin\b/.test(message)) specs.push({ type: 'profit_margin' })
  else if (/\bprofit\b/.test(message)) {
    if (forecast) specs.push({ type: 'profit_forecast' })
    else if (/\b(trend|history|historical|over time|changed?)\b/.test(message)) specs.push({ type: 'profit_trend' })
    else specs.push({ type: 'profit_snapshot' })
  }

  if (/\bbreak[ -]?even\b/.test(message)) {
    specs.push({ type: /\b(progress|toward|towards|close)\b/.test(message) ? 'break_even_progress' : 'break_even_analysis' })
  }

  if (/\b(largest|highest|biggest|top)\b.*\b(expenses?|costs?|payments?)\b|\b(expenses?|costs?)\b.*\b(largest|highest|biggest|top)\b/.test(message)) {
    specs.push({ type: 'largest_expenses' })
  } else if (/\b(expenses?|spending|costs?)\b.*\b(break\s*down|breakdown|categor(?:y|ies)|where)\b|\bbreak\s*down.*\b(expenses?|costs?)\b|\bwhere.*\b(spend|spent|money)\b/.test(message)) {
    specs.push({ type: 'expense_breakdown' })
  } else if (/\b(expenses?|spending|costs?)\b.*\b(change|changed|increase|decrease|significant)\b/.test(message)) {
    specs.push({ type: 'expense_change_detector' })
  }

  if (/\bbudget\b/.test(message)) {
    if (forecast || /\b(over|under|finish|end)\b/.test(message)) specs.push({ type: 'budget_forecast' })
    else if (/\b(remain(?:ing|s)?|left|available)\b/.test(message)) specs.push({ type: 'budget_remaining' })
    else specs.push({ type: 'budget_vs_actual' })
  }
  return specs
}

export function listStage3WidgetCandidates(userMessage: string) {
  return selectStage3FallbackSpecs(userMessage).map((spec) => candidate(spec.type, `stage3-${spec.type}`))
}
