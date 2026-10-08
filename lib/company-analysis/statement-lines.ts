export const STATEMENT_LINE_KEYS = [
  // Statement of profit or loss
  'revenue',
  'cost_of_sales',
  'gross_profit',
  'marketing_expenses',
  'administrative_expenses',
  'total_operating_costs',
  'operating_profit',
  'finance_costs',
  'profit_before_tax',
  'tax_expense',
  'profit_for_year',
  // Statement of changes in equity
  'dividends',
  // Revenue streams, each carrying the stream name in `segment`
  'segment_revenue',
  'segment_direct_costs',
  // Statement of financial position
  'intangible_assets',
  'property_plant_equipment',
  'non_current_assets',
  'inventory',
  'trade_receivables',
  'cash',
  'current_assets',
  'total_assets',
  'share_capital',
  'retained_earnings',
  'total_equity',
  'non_current_borrowings',
  'trade_payables',
  'tax_payable',
  'current_liabilities',
] as const

export type StatementLineKey = (typeof STATEMENT_LINE_KEYS)[number]

/** Lines that belong to one revenue stream rather than the whole company. */
export const SEGMENT_LINE_KEYS = [
  'segment_revenue',
  'segment_direct_costs',
] as const satisfies readonly StatementLineKey[]

export const STATEMENT_LINE_LABELS: Record<StatementLineKey, string> = {
  revenue: 'Revenue',
  cost_of_sales: 'Cost of sales',
  gross_profit: 'Gross profit',
  marketing_expenses: 'Marketing',
  administrative_expenses: 'Administrative expenses',
  total_operating_costs: 'Total operating costs',
  operating_profit: 'Operating profit',
  finance_costs: 'Finance costs',
  profit_before_tax: 'Profit before tax',
  tax_expense: 'Tax',
  profit_for_year: 'Profit for the year',
  dividends: 'Dividends',
  segment_revenue: 'Revenue by stream',
  segment_direct_costs: 'Direct costs by stream',
  intangible_assets: 'Intangible assets',
  property_plant_equipment: 'Property, plant and equipment',
  non_current_assets: 'Non-current assets',
  inventory: 'Inventory',
  trade_receivables: 'Trade and other receivables',
  cash: 'Bank',
  current_assets: 'Current assets',
  total_assets: 'Total assets',
  share_capital: 'Share capital and premium',
  retained_earnings: 'Retained earnings',
  total_equity: 'Total equity',
  non_current_borrowings: 'Loans (non-current)',
  trade_payables: 'Trade and other payables',
  tax_payable: 'Tax payable',
  current_liabilities: 'Current liabilities',
}

export function isStatementLineKey(value: string): value is StatementLineKey {
  return (STATEMENT_LINE_KEYS as readonly string[]).includes(value)
}

export function isSegmentLineKey(key: StatementLineKey): boolean {
  return (SEGMENT_LINE_KEYS as readonly string[]).includes(key)
}
