import type { StatementLineKey } from '@/lib/company-analysis/statement-lines'

export type ChangeTone = 'good' | 'bad' | 'neutral'

export interface YearChange {
  amount: number
  percent: number | null
  direction: 'up' | 'down' | 'flat'
  tone: ChangeTone
}

const BETTER_WHEN_HIGHER = new Set<StatementLineKey>([
  'revenue',
  'segment_revenue',
  'gross_profit',
  'operating_profit',
  'profit_before_tax',
  'profit_for_year',
])

const BETTER_WHEN_LOWER = new Set<StatementLineKey>([
  'cost_of_sales',
  'segment_direct_costs',
  'administrative_expenses',
  'total_operating_costs',
  'finance_costs',
])

export function yearOnYearChange(key: StatementLineKey, latest: number | null, prior: number | null): YearChange | null {
  if (latest === null || prior === null) return null

  const amount = Math.round((latest - prior) * 10_000) / 10_000
  const direction = amount > 0 ? 'up' : amount < 0 ? 'down' : 'flat'
  const percent = prior === 0 ? null : Math.round(((latest - prior) / Math.abs(prior)) * 1000) / 10

  let tone: ChangeTone = 'neutral'
  if (direction !== 'flat' && BETTER_WHEN_HIGHER.has(key)) tone = direction === 'up' ? 'good' : 'bad'
  if (direction !== 'flat' && BETTER_WHEN_LOWER.has(key)) tone = direction === 'down' ? 'good' : 'bad'

  return { amount, percent, direction, tone }
}
