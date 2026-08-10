import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'

export function selectMetricKeysForMessage(
  userMessage: string,
): FinancialMetricKey[] {
  const normalized = userMessage.toLowerCase()
  const keys: FinancialMetricKey[] = []
  const add = (...nextKeys: FinancialMetricKey[]) => {
    for (const key of nextKeys) {
      if (!keys.includes(key)) keys.push(key)
    }
  }

  if (/\brunway\b/.test(normalized)) add('runway_months', 'cash', 'burn_rate')
  if (/\bcash\b/.test(normalized)) add('cash')
  if (/\bburn\b/.test(normalized)) add('burn_rate', 'monthly_expenses')
  if (/\brevenue|income\b/.test(normalized)) add('monthly_revenue')
  if (/\bexpense|cost\b/.test(normalized)) {
    add('monthly_expenses', 'accounts_payable')
  }
  if (/\breceivable|\bar\b/.test(normalized)) add('accounts_receivable')
  if (/\bpayable|\bap\b/.test(normalized)) add('accounts_payable')

  if (keys.length === 0 && /\bmetric|overview|financial|data\b/.test(normalized)) {
    add('runway_months', 'cash', 'burn_rate', 'monthly_revenue')
  }

  return keys.slice(0, 4)
}

export function isDataConnectionRequest(userMessage: string) {
  return /\b(connect|connection|integration|xero|quickbooks|upload|bank feed)\b/i.test(
    userMessage,
  )
}
