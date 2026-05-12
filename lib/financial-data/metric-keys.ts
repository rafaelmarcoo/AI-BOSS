export const FINANCIAL_METRIC_KEYS = [
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'monthly_revenue',
  'monthly_expenses',
  'burn_rate',
  'runway_months',
] as const

export type FinancialMetricKey = (typeof FINANCIAL_METRIC_KEYS)[number]

export const FINANCIAL_METRIC_LABELS: Record<FinancialMetricKey, string> = {
  cash: 'Cash',
  accounts_receivable: 'Accounts receivable',
  accounts_payable: 'Accounts payable',
  monthly_revenue: 'Monthly revenue',
  monthly_expenses: 'Monthly expenses',
  burn_rate: 'Burn rate',
  runway_months: 'Runway months',
}

export function isFinancialMetricKey(
  value: string
): value is FinancialMetricKey {
  return FINANCIAL_METRIC_KEYS.includes(value as FinancialMetricKey)
}
