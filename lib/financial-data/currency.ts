export const SUPPORTED_FINANCIAL_CURRENCIES = ['NZD', 'AUD'] as const

export type SupportedFinancialCurrency =
  (typeof SUPPORTED_FINANCIAL_CURRENCIES)[number]

export function isSupportedFinancialCurrency(
  currency: string | null | undefined
): currency is SupportedFinancialCurrency {
  return SUPPORTED_FINANCIAL_CURRENCIES.includes(
    currency as SupportedFinancialCurrency
  )
}

export function formatFinancialCurrency(
  value: number,
  currency: SupportedFinancialCurrency,
  maximumFractionDigits = 0
) {
  const formattedValue = new Intl.NumberFormat('en-NZ', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(Math.abs(value))

  return `${value < 0 ? '-' : ''}${currency} ${formattedValue}`
}
