import { yearOnYearChange } from '@/lib/company-analysis/year-change'

describe('yearOnYearChange', () => {
  it.each([
    ['revenue up is good', 'revenue', 251, 237.2, 'up', 'good'],
    ['profit down is bad', 'operating_profit', 70, 74.1, 'down', 'bad'],
    ['a cost going up is bad', 'administrative_expenses', 59.6, 58.6, 'up', 'bad'],
    ['a cost going down is good', 'finance_costs', 6.8, 7.6, 'down', 'good'],
    ['loans going up depends on context', 'non_current_borrowings', 95, 85, 'up', 'neutral'],
    ['dividends are a trade-off', 'dividends', 48.7, 40, 'up', 'neutral'],
    ['a revenue stream growing is good', 'segment_revenue', 120, 113.1, 'up', 'good'],
  ] as const)('%s', (_case, key, latest, prior, direction, tone) => {
    expect(yearOnYearChange(key, latest, prior)).toMatchObject({ direction, tone })
  })

  it('gives the amount and a one-decimal percentage, without rounding noise', () => {
    expect(yearOnYearChange('revenue', 251, 237.2)).toEqual({ amount: 13.8, percent: 5.8, direction: 'up', tone: 'good' })
  })

  it('shows no percentage when the previous year was zero', () => {
    expect(yearOnYearChange('dividends', 48.7, 0)).toMatchObject({ amount: 48.7, percent: null })
  })

  it('treats an unchanged line as flat and never colours it', () => {
    expect(yearOnYearChange('revenue', 237.2, 237.2)).toEqual({ amount: 0, percent: 0, direction: 'flat', tone: 'neutral' })
  })

  it('has nothing to compare when either year is blank', () => {
    expect(yearOnYearChange('revenue', 237.2, null)).toBeNull()
    expect(yearOnYearChange('revenue', null, 216.2)).toBeNull()
  })
})
