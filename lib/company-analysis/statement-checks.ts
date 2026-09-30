import type { StatementYear } from '@/lib/company-analysis/statement-analysis'

export interface StatementCheck {
  id: string
  label: string
  passed: boolean
  reported: number
  expected: number
  message: string
}

function withinRounding(reported: number, expected: number) {
  return Math.abs(reported - expected) <= Math.max(0.051, Math.abs(expected) * 0.001)
}

function show(value: number) {
  return Number(value.toFixed(2)).toString()
}

type LineKey = keyof StatementYear['lines']

function check(
  id: string,
  label: string,
  reported: number | undefined,
  expected: number | null,
  name: string,
  parts: string
): StatementCheck[] {
  if (reported === undefined || expected === null) return []
  const passed = withinRounding(reported, expected)
  return [
    {
      id,
      label,
      passed,
      reported,
      expected,
      message: passed ? '' : `${name}: the file says ${show(reported)}, but ${parts} = ${show(expected)}.`,
    },
  ]
}

function sum(year: StatementYear, keys: LineKey[]) {
  let total = 0
  for (const key of keys) {
    const value = year.lines[key]
    if (value === undefined) return null
    total += value
  }
  return total
}

export function checkStatementYear(year: StatementYear, prior?: StatementYear): StatementCheck[] {
  const l = year.lines
  const directCosts = year.streams.reduce((total, stream) => total + (stream.directCosts ?? 0), 0)

  const operatingProfitExpected =
    l.cost_of_sales !== undefined
      ? l.gross_profit !== undefined && l.administrative_expenses !== undefined
        ? l.gross_profit - l.administrative_expenses - (l.marketing_expenses ?? 0)
        : null
      : l.revenue !== undefined && l.total_operating_costs !== undefined
        ? l.revenue - l.total_operating_costs
        : null

  return [
    ...check(
      'revenue_streams',
      'Revenue equals the sum of its revenue streams',
      year.streams.length > 0 ? l.revenue : undefined,
      year.streams.reduce((total, stream) => total + stream.revenue, 0),
      'Revenue',
      'the revenue streams added together'
    ),
    ...check(
      'gross_profit',
      'Gross profit equals revenue less cost of sales',
      l.gross_profit,
      l.revenue !== undefined && l.cost_of_sales !== undefined ? l.revenue - l.cost_of_sales : null,
      'Gross profit',
      'revenue - cost of sales'
    ),
    ...check(
      'total_operating_costs',
      'Total operating costs equal direct costs, marketing and administration',
      l.total_operating_costs,
      l.administrative_expenses !== undefined
        ? directCosts + (l.marketing_expenses ?? 0) + l.administrative_expenses
        : null,
      'Total operating costs',
      'direct costs + marketing + administration'
    ),
    ...check('operating_profit', 'Operating profit follows from revenue and costs', l.operating_profit, operatingProfitExpected, 'Operating profit', 'revenue - costs'),
    ...check(
      'profit_before_tax',
      'Profit before tax equals operating profit less finance costs',
      l.profit_before_tax,
      l.operating_profit !== undefined && l.finance_costs !== undefined ? l.operating_profit - l.finance_costs : null,
      'Profit before tax',
      'operating profit - finance costs'
    ),
    ...check(
      'profit_for_year',
      'Profit for the year equals profit before tax less tax',
      l.profit_for_year,
      l.profit_before_tax !== undefined && l.tax_expense !== undefined ? l.profit_before_tax - l.tax_expense : null,
      'Profit for the year',
      'profit before tax - tax'
    ),
    ...check('non_current_assets', 'Non-current assets add up', l.non_current_assets, sum(year, ['intangible_assets', 'property_plant_equipment']), 'Non-current assets', 'intangible assets + property, plant and equipment'),
    ...check('current_assets', 'Current assets add up', l.current_assets, sum(year, ['inventory', 'trade_receivables', 'cash']), 'Current assets', 'inventory + receivables + bank'),
    ...check('total_assets', 'Total assets equal non-current plus current assets', l.total_assets, sum(year, ['non_current_assets', 'current_assets']), 'Total assets', 'non-current assets + current assets'),
    ...check('total_equity', 'Total equity equals share capital plus retained earnings', l.total_equity, sum(year, ['share_capital', 'retained_earnings']), 'Total equity', 'share capital + retained earnings'),
    ...check('current_liabilities', 'Current liabilities add up', l.current_liabilities, sum(year, ['trade_payables', 'tax_payable']), 'Current liabilities', 'payables + tax payable'),
    ...check(
      'balance_sheet',
      'Total assets equal equity plus liabilities',
      l.total_assets,
      sum(year, ['total_equity', 'non_current_borrowings', 'current_liabilities']),
      'Balance sheet',
      'equity + loans + current liabilities'
    ),
    ...check(
      'retained_earnings',
      "Retained earnings roll forward from last year's through profit and dividends",
      l.retained_earnings,
      prior?.lines.retained_earnings !== undefined && l.profit_for_year !== undefined && l.dividends !== undefined
        ? prior.lines.retained_earnings + l.profit_for_year - l.dividends
        : null,
      'Retained earnings',
      "last year's retained earnings + profit - dividends"
    ),
  ]
}

export function checkStatements(years: StatementYear[]) {
  return years.map((year, index) => ({
    fiscalYearEnd: year.fiscalYearEnd,
    checks: checkStatementYear(year, years[index + 1]),
  }))
}
