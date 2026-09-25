export type RatioStatus = 'strong' | 'healthy' | 'caution' | 'weak'

export interface RatioResult {
  key: RatioKey
  label: string
  value: number
  status: RatioStatus
  interpretation: string
  formula: string
}

export type RatioKey =
  | 'gross_margin'
  | 'operating_margin'
  | 'current_ratio'
  | 'debt_to_equity'

export interface RatioInputs {
  monthlyRevenue?: number | null
  costOfSales?: number | null
  operatingProfit?: number | null
  currentAssets?: number | null
  currentLiabilities?: number | null
  totalDebt?: number | null
  totalEquity?: number | null
}

function round(value: number, places = 2) {
  return Number(value.toFixed(places))
}

function isUsable(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function calculateGrossMargin(
  revenue: number | null | undefined,
  costOfSales: number | null | undefined
): RatioResult | null {
  if (!isUsable(revenue) || !isUsable(costOfSales) || revenue === 0) return null

  const grossProfit = revenue - costOfSales
  const value = round((grossProfit / revenue) * 100)

  const status: RatioStatus =
    value >= 50 ? 'strong' : value >= 30 ? 'healthy' : value >= 10 ? 'caution' : 'weak'

  return {
    key: 'gross_margin',
    label: 'Gross margin',
    value,
    status,
    interpretation:
      `${value}% of revenue remains after direct costs. ` +
      (value < 10
        ? 'Below 10% leaves little to cover overheads.'
        : value < 30
          ? 'Below 30% is thin for most sectors; compare against industry norms.'
          : 'This is a workable margin, though sector norms vary widely.'),
    formula: `(${revenue} − ${costOfSales}) ÷ ${revenue} × 100 = ${value}%`,
  }
}

export function calculateOperatingMargin(
  revenue: number | null | undefined,
  operatingProfit: number | null | undefined
): RatioResult | null {
  if (!isUsable(revenue) || !isUsable(operatingProfit) || revenue === 0) return null

  const value = round((operatingProfit / revenue) * 100)

  const status: RatioStatus =
    value >= 20 ? 'strong' : value >= 10 ? 'healthy' : value >= 0 ? 'caution' : 'weak'

  return {
    key: 'operating_margin',
    label: 'Operating margin',
    value,
    status,
    interpretation:
      value < 0
        ? `Operating at a loss: ${value}% of revenue. Costs exceed revenue before financing and tax.`
        : `${value}% of revenue remains after operating costs.`,
    formula: `${operatingProfit} ÷ ${revenue} × 100 = ${value}%`,
  }
}

export function calculateCurrentRatio(
  currentAssets: number | null | undefined,
  currentLiabilities: number | null | undefined
): RatioResult | null {
  if (
    !isUsable(currentAssets) ||
    !isUsable(currentLiabilities) ||
    currentLiabilities === 0
  ) {
    return null
  }

  const value = round(currentAssets / currentLiabilities)

  const status: RatioStatus =
    value >= 2 ? 'strong' : value >= 1.5 ? 'healthy' : value >= 1 ? 'caution' : 'weak'

  return {
    key: 'current_ratio',
    label: 'Current ratio',
    value,
    status,
    interpretation:
      value < 1
        ? `${value} means current liabilities exceed current assets — a liquidity risk requiring attention.`
        : `${value} of current assets for every 1 of current liabilities. Above 1.5 is generally healthy, above 2 strong.`,
    formula: `${currentAssets} ÷ ${currentLiabilities} = ${value}`,
  }
}

export function calculateDebtToEquity(
  totalDebt: number | null | undefined,
  totalEquity: number | null | undefined
): RatioResult | null {
  if (!isUsable(totalDebt) || !isUsable(totalEquity) || totalEquity === 0) {
    return null
  }

  const value = round(totalDebt / totalEquity)

  const status: RatioStatus =
    value <= 0.5 ? 'strong' : value <= 1 ? 'healthy' : value <= 2 ? 'caution' : 'weak'

  return {
    key: 'debt_to_equity',
    label: 'Debt-to-equity',
    value,
    status,
    interpretation:
      value > 2
        ? `${value} is elevated leverage — debt is more than twice equity.`
        : `${value} of debt for every 1 of equity. Below 1 is conservative; above 2 is generally considered elevated.`,
    formula: `${totalDebt} ÷ ${totalEquity} = ${value}`,
  }
}

export const RATIO_INPUTS: Record<RatioKey, string[]> = {
  gross_margin: ['monthly_revenue', 'cost_of_sales'],
  operating_margin: ['monthly_revenue', 'operating_profit'],
  current_ratio: ['current_assets', 'current_liabilities'],
  debt_to_equity: ['total_debt', 'total_equity'],
}

export interface RatioSet {
  calculated: RatioResult[]
  unavailable: { key: RatioKey; label: string; missing: string[] }[]
}

const RATIO_LABELS: Record<RatioKey, string> = {
  gross_margin: 'Gross margin',
  operating_margin: 'Operating margin',
  current_ratio: 'Current ratio',
  debt_to_equity: 'Debt-to-equity',
}

export function calculateRatios(inputs: RatioInputs): RatioSet {
  const attempts: {
    key: RatioKey
    result: RatioResult | null
    values: (number | null | undefined)[]
  }[] = [
    {
      key: 'gross_margin',
      result: calculateGrossMargin(inputs.monthlyRevenue, inputs.costOfSales),
      values: [inputs.monthlyRevenue, inputs.costOfSales],
    },
    {
      key: 'operating_margin',
      result: calculateOperatingMargin(inputs.monthlyRevenue, inputs.operatingProfit),
      values: [inputs.monthlyRevenue, inputs.operatingProfit],
    },
    {
      key: 'current_ratio',
      result: calculateCurrentRatio(inputs.currentAssets, inputs.currentLiabilities),
      values: [inputs.currentAssets, inputs.currentLiabilities],
    },
    {
      key: 'debt_to_equity',
      result: calculateDebtToEquity(inputs.totalDebt, inputs.totalEquity),
      values: [inputs.totalDebt, inputs.totalEquity],
    },
  ]

  const calculated: RatioResult[] = []
  const unavailable: RatioSet['unavailable'] = []

  for (const { key, result, values } of attempts) {
    if (result) {
      calculated.push(result)
      continue
    }

    const missing = RATIO_INPUTS[key].filter(
      (_name, index) => !isUsable(values[index])
    )

    unavailable.push({
      key,
      label: RATIO_LABELS[key],
      missing: missing.length > 0 ? missing : ['a non-zero denominator'],
    })
  }

  return { calculated, unavailable }
}
