import {
  calculateRatios,
  calculateCurrentRatio,
  calculateDebtToEquity,
  calculateGrossMargin,
  calculateOperatingMargin,
} from '@/lib/calculations/ratios'

describe('financial ratios', () => {
  it('calculates gross margin from revenue and cost of sales', () => {
    const result = calculateGrossMargin(38000, 22800)

    expect(result).toMatchObject({ key: 'gross_margin', value: 40, status: 'healthy' })
    expect(result?.formula).toContain('38000')
  })

  it('reports a negative operating margin as a loss', () => {
    const result = calculateOperatingMargin(38000, -23000)

    expect(result?.value).toBeCloseTo(-60.53, 2)
    expect(result?.status).toBe('weak')
    expect(result?.interpretation).toContain('loss')
  })

  it('calculates current ratio and flags liabilities exceeding assets', () => {
    expect(calculateCurrentRatio(227000, 95000)).toMatchObject({
      value: 2.39,
      status: 'strong',
    })

    const tight = calculateCurrentRatio(80000, 100000)
    expect(tight?.value).toBe(0.8)
    expect(tight?.status).toBe('weak')
    expect(tight?.interpretation).toContain('liquidity risk')
  })

  it('calculates debt-to-equity and flags elevated leverage', () => {
    expect(calculateDebtToEquity(140000, 310000)).toMatchObject({
      value: 0.45,
      status: 'strong',
    })

    const leveraged = calculateDebtToEquity(300000, 100000)
    expect(leveraged?.value).toBe(3)
    expect(leveraged?.status).toBe('weak')
  })

  it('returns null rather than dividing by zero', () => {
    expect(calculateGrossMargin(0, 100)).toBeNull()
    expect(calculateOperatingMargin(0, 100)).toBeNull()
    expect(calculateCurrentRatio(100, 0)).toBeNull()
    expect(calculateDebtToEquity(100, 0)).toBeNull()
  })

  it('returns null when an input is missing rather than substituting one', () => {
    expect(calculateGrossMargin(38000, null)).toBeNull()
    expect(calculateCurrentRatio(undefined, 95000)).toBeNull()
  })

  it('separates calculable ratios from those with missing inputs', () => {
    const { calculated, unavailable } = calculateRatios({
      monthlyRevenue: 38000,
      costOfSales: 22800,
      currentAssets: 227000,
      currentLiabilities: 95000,
    })

    expect(calculated.map((ratio) => ratio.key)).toEqual([
      'gross_margin',
      'current_ratio',
    ])

    const missing = Object.fromEntries(
      unavailable.map((ratio) => [ratio.key, ratio.missing])
    )

    expect(missing.operating_margin).toEqual(['operating_profit'])
    expect(missing.debt_to_equity).toEqual(['total_debt', 'total_equity'])
  })

  it('reports every ratio as unavailable when no metrics exist', () => {
    const { calculated, unavailable } = calculateRatios({})

    expect(calculated).toHaveLength(0)
    expect(unavailable).toHaveLength(4)
  })
})
