import { GEN_UI_WIDGET_CATALOG } from '@/lib/gen-ui/catalog'
import type { PlannerWidget } from '@/lib/gen-ui/builders/types'
import type { GenUiWidgetType } from '@/lib/gen-ui/types'

export interface Stage4WidgetCandidate {
  id: string
  type: GenUiWidgetType
  label: string
  description: string
  selectionGuidance: string
  redundancyGroup: string
}

function candidate(type: GenUiWidgetType, redundancyGroup: string): Stage4WidgetCandidate {
  const entry = GEN_UI_WIDGET_CATALOG[type]
  return {
    id: `stage4_${type}`,
    type,
    label: entry.label,
    description: entry.description,
    selectionGuidance: entry.selectionGuidance,
    redundancyGroup,
  }
}

export function selectStage4FallbackSpecs(userMessage: string): PlannerWidget[] {
  const message = userMessage.toLowerCase()
  const specs: PlannerWidget[] = []

  if (/\b(invoice|receivables?)\s+ageing\b|\baged\s+(invoice|receivables?)\b|\baging\s+(invoice|receivables?)\b/.test(message)) {
    specs.push({ type: 'invoice_ageing' })
  } else if (/\boverdue\b.*\b(invoices?|receivables?|customer payments?)\b|\b(invoices?|receivables?)\b.*\boverdue\b/.test(message)) {
    specs.push({ type: 'overdue_invoices' })
  }

  if (/\b(bills?|supplier invoices?|vendor invoices?)\b.*\b(due|upcoming|next)\b|\b(due|upcoming)\b.*\b(bills?|supplier invoices?|vendor invoices?)\b/.test(message)) {
    specs.push({ type: 'bills_due' })
  } else if (/\b(expected|upcoming|next)\b.*\b(customer payments?|invoice payments?|receipts?)\b|\b(customer payments?|invoice payments?|receipts?)\b.*\b(expected|upcoming|next|due)\b|\b(customer invoices?|sales invoices?)\b.*\b(due|upcoming|next)\b/.test(message)) {
    specs.push({ type: 'expected_payments' })
  }

  return specs
}

export function listStage4WidgetCandidates(userMessage: string) {
  return selectStage4FallbackSpecs(userMessage).map((spec) =>
    candidate(spec.type, `stage4-${spec.type}`)
  )
}
