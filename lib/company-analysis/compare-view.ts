import type {
  CompanyComparison,
  RatioCategory,
  RatioComparison,
  RatioKey,
} from '@/lib/company-analysis/statement-analysis'

export const RATIO_MEANINGS: Record<RatioKey, string> = {
  gross_margin: 'Of each $1 of sales, what is left after the cost of the goods sold.',
  margin_after_direct_costs: 'Of each $1 of sales, what is left after the direct costs of the revenue streams.',
  operating_margin: 'Of each $1 of sales, what is left after all running costs, before interest and tax.',
  net_margin: 'Of each $1 of sales, what is left after everything, including interest and tax.',
  return_on_capital_employed: 'Operating profit for every $1 invested by owners and lenders together.',
  return_on_equity: "Profit for every $1 of the owners' money.",
  current_ratio: 'Short-term assets for every $1 of short-term bills.',
  quick_ratio: 'Short-term assets, leaving out stock, for every $1 of short-term bills.',
  inventory_days: 'How many days of stock the company holds.',
  receivable_days: 'How long customers take to pay.',
  payable_days: 'How long the company takes to pay its suppliers.',
  asset_turnover: 'Sales made for every $1 of assets.',
  debt_to_equity: "Loans for every $1 of the owners' money.",
  gearing: 'The share of the business funded by loans.',
  interest_cover: 'How many times operating profit covers the interest bill.',
  marketing_to_revenue: 'The share of sales spent on marketing.',
  administration_to_revenue: 'The share of sales spent on administration.',
  dividend_payout: 'The share of profit paid out to the owners.',
}

const CATEGORY_HEADINGS: Array<[RatioCategory, string]> = [
  ['profitability', 'Profit: how much of each sale is kept'],
  ['liquidity', 'Liquidity: can it pay its bills soon?'],
  ['efficiency', 'Efficiency: how quickly money moves'],
  ['gearing', 'Debt: how much it relies on borrowing'],
  ['cost_structure', 'Costs'],
  ['shareholder', 'Payouts to owners'],
]

export function groupRatios(ratios: RatioComparison[]) {
  return CATEGORY_HEADINGS.map(([category, heading]) => ({
    category,
    heading,
    ratios: ratios.filter((ratio) => ratio.category === category),
  })).filter((group) => group.ratios.length > 0)
}

export function verdict(ratio: RatioComparison) {
  if (ratio.direction === 'neutral') return { kind: 'trade-off' as const, text: 'Trade-off' }
  if (ratio.stronger === null) return { kind: 'level' as const, text: 'Level' }
  return { kind: 'stronger' as const, text: ratio.stronger }
}

export interface OneSidedRatio {
  key: RatioKey
  label: string
  has: string
  reason: string
}

export function ratiosOnlyOneHas(comparison: CompanyComparison): OneSidedRatio[] {
  const shared = new Set(comparison.ratios.map((ratio) => ratio.key))
  const sides = [
    [comparison.first, comparison.second],
    [comparison.second, comparison.first],
  ] as const

  return sides.flatMap(([owner, other]) =>
    owner.latest.ratios
      .filter((ratio) => !shared.has(ratio.key))
      .map((ratio) => {
        const missing = other.latest.unavailable.find((item) => item.key === ratio.key)
        return {
          key: ratio.key,
          label: ratio.label,
          has: owner.name,
          reason: missing
            ? `${other.name} has no ${missing.missing.join(', ')} in its statements.`
            : `${other.name} reports this on a different basis (cost of sales versus revenue streams).`,
        }
      })
  )
}

export function workingFor(comparison: CompanyComparison, side: 'first' | 'second', key: RatioKey) {
  return comparison[side].latest.ratios.find((ratio) => ratio.key === key)?.working ?? null
}
