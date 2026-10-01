import type { FinancialMetricKey } from '@/lib/financial-data'

// Metrics that represent a total naturally made up of multiple line items:
// several revenue or expense lines in one document should add up to one
// combined observation, not silently overwrite each other. Burn rate and
// runway aren't sums of anything, so those keep "first match wins" instead.
export const ADDITIVE_METRIC_KEYS = new Set<FinancialMetricKey>([
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'monthly_revenue',
  'monthly_expenses',
])
