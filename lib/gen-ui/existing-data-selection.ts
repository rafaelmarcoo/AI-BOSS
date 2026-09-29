import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import { GEN_UI_WIDGET_CATALOG } from '@/lib/gen-ui/catalog'
import type { PlannerWidget } from '@/lib/gen-ui/builders/types'
import type { GenUiWidgetType } from '@/lib/gen-ui/types'

export interface ExistingDataCandidate {
  id: string
  type: GenUiWidgetType
  label: string
  description: string
  selectionGuidance: string
  redundancyGroup: string
}

interface ExistingDataSelectionContext {
  userMessage: string
  availableMetricKeys: readonly FinancialMetricKey[]
  historicalMetricKey: FinancialMetricKey | null
  hasHistoricalSeries: boolean
}

function candidate(type: GenUiWidgetType, redundancyGroup: string): ExistingDataCandidate {
  const entry = GEN_UI_WIDGET_CATALOG[type]
  return {
    id: `existing_data_${type}`,
    type,
    label: entry.label,
    description: entry.description,
    selectionGuidance: entry.selectionGuidance,
    redundancyGroup,
  }
}

export function listExistingDataWidgetCandidates(
  context: ExistingDataSelectionContext,
): ExistingDataCandidate[] {
  const normalized = context.userMessage.toLowerCase()
  const candidates: ExistingDataCandidate[] = []
  const available = new Set(context.availableMetricKeys)
  const explicitTrend = /\b(history|historical|trend|over time|changed?|increase|decrease|growth)\b/.test(normalized)
  const futureFocused = /\b(future|forecast|project|next\s+\d*\s*months?)\b/.test(normalized)

  if (/\b(cash balance|cash on hand|available cash|current cash|cash position|how much cash)\b/.test(normalized)) {
    candidates.push(candidate('cash_balance', 'cash-current'))
  }

  if (/\b(accounts? receivable|receivables?|owed by customers?|customers? owe)\b/.test(normalized)) {
    candidates.push(candidate('accounts_receivable', 'receivables-current'))
  }

  if (/\b(accounts? payable|payables?|owed to suppliers?|owe suppliers?)\b/.test(normalized)) {
    candidates.push(candidate('accounts_payable', 'payables-current'))
  }

  if (/\b(revenue|income)\b/.test(normalized) && !futureFocused) {
    if (/\bgrowth\b/.test(normalized)) {
      candidates.push(candidate('revenue_growth', 'revenue-change'))
    } else if (explicitTrend) {
      candidates.push(candidate('revenue_trend', 'revenue-change'))
    } else {
      candidates.push(candidate('revenue_snapshot', 'revenue-current'))
    }
  }

  if (/\b(expenses?|spending|total costs?)\b/.test(normalized) && !futureFocused) {
    candidates.push(
      explicitTrend
        ? candidate('expense_trend', 'expense-change')
        : candidate('expense_summary', 'expense-current'),
    )
  }

  if (/\b(financial brief|financial overview|financial health|business health|financial summary)\b/.test(normalized)) {
    if (available.size > 0) {
      candidates.push(candidate('ai_financial_brief', 'financial-brief'))
    }
  }

  // Directly requested unavailable widgets remain eligible so their shared
  // unavailable state can explain the data gap honestly. History availability
  // is otherwise used by the planner as context, not fabricated by the model.
  return candidates.filter((item) => {
    if (item.type === 'revenue_trend' || item.type === 'revenue_growth') {
      return context.historicalMetricKey === 'monthly_revenue'
        || context.hasHistoricalSeries
    }
    if (item.type === 'expense_trend') {
      return context.historicalMetricKey === 'monthly_expenses'
        || context.hasHistoricalSeries
    }
    return true
  })
}

export function selectExistingDataFallbackSpecs(userMessage: string): PlannerWidget[] {
  const normalized = userMessage.toLowerCase()
  const specs: PlannerWidget[] = []
  const explicitTrend = /\b(history|historical|trend|over time|changed?|increase|decrease|growth)\b/.test(normalized)
  const futureFocused = /\b(future|forecast|project|next\s+\d*\s*months?)\b/.test(normalized)

  if (/\b(cash balance|cash on hand|available cash|current cash|cash position|how much cash)\b/.test(normalized)) {
    specs.push({ type: 'cash_balance' })
  }
  if (/\b(accounts? receivable|receivables?|owed by customers?|customers? owe)\b/.test(normalized)) {
    specs.push({ type: 'accounts_receivable' })
  }
  if (/\b(accounts? payable|payables?|owed to suppliers?|owe suppliers?)\b/.test(normalized)) {
    specs.push({ type: 'accounts_payable' })
  }
  if (/\b(revenue|income)\b/.test(normalized) && !futureFocused) {
    specs.push({
      type: /\bgrowth\b/.test(normalized)
        ? 'revenue_growth'
        : explicitTrend
          ? 'revenue_trend'
          : 'revenue_snapshot',
    })
  }
  if (/\b(expenses?|spending|total costs?)\b/.test(normalized) && !futureFocused) {
    specs.push({ type: explicitTrend ? 'expense_trend' : 'expense_summary' })
  }
  if (/\b(financial brief|financial overview|financial health|business health|financial summary)\b/.test(normalized)) {
    specs.push({ type: 'ai_financial_brief' })
  }

  return specs
}
