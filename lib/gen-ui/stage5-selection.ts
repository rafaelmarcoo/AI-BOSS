import { GEN_UI_WIDGET_CATALOG } from '@/lib/gen-ui/catalog'
import type { PlannerWidget } from '@/lib/gen-ui/builders/types'
import type { GenUiWidgetType } from '@/lib/gen-ui/types'

function candidate(type: GenUiWidgetType) {
  const entry = GEN_UI_WIDGET_CATALOG[type]
  return {
    id: `stage5_${type}`,
    type,
    label: entry.label,
    description: entry.description,
    selectionGuidance: entry.selectionGuidance,
    redundancyGroup: `stage5-${type}`,
  }
}

export function selectStage5FallbackSpecs(userMessage: string): PlannerWidget[] {
  const message = userMessage.toLowerCase()
  const specs: PlannerWidget[] = []
  if (/\bworking capital\b/.test(message)) specs.push({ type: 'working_capital' })
  if (/\bcurrent ratio\b/.test(message)) specs.push({ type: 'current_ratio' })
  if (/\bquick ratio\b|\bacid[- ]test\b/.test(message)) specs.push({ type: 'quick_ratio' })
  if (/\b(asset|assets)\b.*\b(summary|breakdown|overview|position)\b|\bwhat (assets|asset)\b/.test(message)) specs.push({ type: 'asset_summary' })
  if (/\b(liability|liabilities)\b.*\b(summary|breakdown|overview|position)\b|\bwhat (liabilities|liability)\b/.test(message)) specs.push({ type: 'liability_summary' })
  if (/\b(equity|net assets?)\b.*\b(snapshot|summary|position|overview)\b|\bowner'?s equity\b/.test(message)) specs.push({ type: 'equity_snapshot' })
  if (/\b(debt|loan|borrowings?)\b.*\b(overview|balance|summary|position)\b/.test(message)) specs.push({ type: 'debt_overview' })
  if (/\b(debt|loan)\b.*\b(repayment|payment|schedule|timeline|due)\b|\b(repayment|payment)\b.*\b(debt|loan)\b/.test(message)) specs.push({ type: 'debt_repayment_timeline' })
  return specs
}

export function listStage5WidgetCandidates(userMessage: string) {
  return selectStage5FallbackSpecs(userMessage).map((spec) => candidate(spec.type))
}
