import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from '@/lib/financial-data/currency'

describe('financial currency helpers', () => {
  it('supports only the MVP currencies', () => {
    expect(isSupportedFinancialCurrency('NZD')).toBe(true)
    expect(isSupportedFinancialCurrency('AUD')).toBe(true)
    expect(isSupportedFinancialCurrency('USD')).toBe(false)
    expect(isSupportedFinancialCurrency(null)).toBe(false)
  })

  it('formats monetary values with an unambiguous currency code', () => {
    expect(formatFinancialCurrency(100000, 'NZD')).toBe('NZD 100,000')
    expect(formatFinancialCurrency(42500.5, 'AUD', 2)).toBe('AUD 42,500.5')
    expect(formatFinancialCurrency(-10000, 'NZD')).toBe('-NZD 10,000')
  })
})
