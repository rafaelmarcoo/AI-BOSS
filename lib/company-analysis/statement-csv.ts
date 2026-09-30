import { parseCsvTabularData } from '@/lib/documents/tabular'
import type { StatementLineKey } from '@/lib/company-analysis/statement-lines'
import type { StatementYear } from '@/lib/company-analysis/statement-analysis'

type CompanyLineKey = Exclude<StatementLineKey, 'segment_revenue' | 'segment_direct_costs'>

const LINE_NAMES: Record<CompanyLineKey, string[]> = {
  revenue: ['revenue', 'revenues', 'total revenue', 'sales', 'turnover'],
  cost_of_sales: ['cost of sales', 'cost of goods sold', 'cogs'],
  gross_profit: ['gross profit'],
  marketing_expenses: ['marketing', 'marketing expenses', 'marketing costs'],
  administrative_expenses: ['administrative expenses', 'administration', 'administration expenses', 'admin'],
  total_operating_costs: ['total operating costs', 'operating costs'],
  operating_profit: ['operating profit', 'operating income', 'ebit'],
  finance_costs: ['finance costs', 'finance cost', 'interest', 'interest expense'],
  profit_before_tax: ['profit before tax', 'pbt'],
  tax_expense: ['tax', 'tax expense', 'income tax', 'income tax expense', 'taxation'],
  profit_for_year: ['profit for the year', 'profit for year', 'net profit', 'profit after tax'],
  dividends: ['dividends', 'dividends paid'],
  intangible_assets: ['intangible assets', 'intangibles'],
  property_plant_equipment: ['property plant and equipment', 'ppe'],
  non_current_assets: ['non current assets', 'total non current assets'],
  inventory: ['inventory', 'inventories', 'stock'],
  trade_receivables: ['trade and other receivables', 'trade receivables', 'receivables', 'accounts receivable'],
  cash: ['bank', 'cash', 'cash at bank', 'cash and cash equivalents'],
  current_assets: ['current assets', 'total current assets'],
  total_assets: ['total assets'],
  share_capital: ['share capital and premium', 'share capital and share premium', 'share capital'],
  retained_earnings: ['retained earnings'],
  total_equity: ['total equity', 'equity'],
  non_current_borrowings: ['loans non current', 'loans', 'loans and lease liabilities', 'borrowings', 'non current borrowings', 'long term debt'],
  trade_payables: ['trade and other payables', 'trade payables', 'payables', 'accounts payable'],
  tax_payable: ['tax payable', 'current tax', 'tax liability', 'income tax payable'],
  current_liabilities: ['current liabilities', 'total current liabilities'],
}

const KEY_BY_NAME = new Map<string, CompanyLineKey>(
  (Object.entries(LINE_NAMES) as Array<[CompanyLineKey, string[]]>).flatMap(([key, names]) =>
    names.map((name) => [name, key] as const)
  )
)

const COST_KEYS = new Set<StatementLineKey>([
  'cost_of_sales',
  'marketing_expenses',
  'administrative_expenses',
  'total_operating_costs',
  'finance_costs',
  'tax_expense',
  'dividends',
  'segment_direct_costs',
])

const NEVER_NEGATIVE = new Set<StatementLineKey>([
  'revenue',
  'segment_revenue',
  'intangible_assets',
  'property_plant_equipment',
  'non_current_assets',
  'inventory',
  'trade_receivables',
  'cash',
  'current_assets',
  'total_assets',
  'share_capital',
  'non_current_borrowings',
  'trade_payables',
  'tax_payable',
  'current_liabilities',
])

const LARGEST_STORABLE = 1e14

export function normalizeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseAmount(raw: string): number | null | 'invalid' {
  const text = raw.trim()
  if (!text || /^[-–—]$/.test(text)) return null
  const negative = /^\(.*\)$/.test(text) || text.startsWith('-')
  const digits = text.replace(/[(),\s]/g, '').replace(/^-/, '')
  if (!/^\d+(\.\d+)?$/.test(digits)) return 'invalid'
  const value = Number(digits)
  return negative ? -value : value
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export interface StatementCsvResult {
  years: StatementYear[]
  unrecognised: Array<{ rowNumber: number; label: string }>
  errors: string[]
}

type RowTarget =
  | { kind: 'line'; key: CompanyLineKey }
  | { kind: 'stream'; key: 'segment_revenue' | 'segment_direct_costs'; name: string }

function targetFor(label: string): RowTarget | null {
  const stream = label.match(/^\s*revenue stream\s*:\s*(.+)$/i)
  if (stream) return { kind: 'stream', key: 'segment_revenue', name: stream[1].trim() }
  const costs = label.match(/^\s*direct costs?\s*:\s*(.+)$/i)
  if (costs) return { kind: 'stream', key: 'segment_direct_costs', name: costs[1].trim() }
  const key = KEY_BY_NAME.get(normalizeLabel(label))
  return key ? { kind: 'line', key } : null
}

export function parseStatementCsv(fileBytes: Uint8Array): StatementCsvResult {
  let sheet
  try {
    sheet = parseCsvTabularData(fileBytes).sheets[0]
  } catch (error) {
    return { years: [], unrecognised: [], errors: [error instanceof Error ? error.message : 'The file could not be read as CSV.'] }
  }

  const errors: string[] = []
  const unrecognised: StatementCsvResult['unrecognised'] = []
  const yearHeaders = sheet.headers.slice(1)

  if (yearHeaders.length === 0) {
    errors.push('The file needs at least one year column, with the year-end date at the top, like 2025-03-31.')
  }
  for (const header of yearHeaders) {
    if (/^\d{4}-\d{2}-\d{2}_\d+$/.test(header)) {
      errors.push(`The year ${header.replace(/_\d+$/, '')} is in the file twice.`)
    } else if (!isIsoDate(header)) {
      errors.push(`The column heading "${header}" isn't a date. Write it like 2025-03-31.`)
    }
  }
  if (errors.length > 0) return { years: [], unrecognised, errors }

  const years = new Map<string, StatementYear>(
    yearHeaders.map((date) => [date, { fiscalYearEnd: date, lines: {}, streams: [] }])
  )
  const seenAt = new Map<string, number>()
  const columnsWithCellErrors = new Set<string>()

  for (const row of sheet.rows) {
    const label = row.values[0]?.trim() ?? ''
    if (!label) continue

    const target = targetFor(label)
    if (!target) {
      unrecognised.push({ rowNumber: row.rowNumber, label })
      continue
    }

    const identity = target.kind === 'line' ? target.key : `${target.key}:${target.name.toLowerCase()}`
    const firstRow = seenAt.get(identity)
    if (firstRow !== undefined) {
      errors.push(`"${label}" is in the file twice (rows ${firstRow} and ${row.rowNumber}).`)
      continue
    }
    seenAt.set(identity, row.rowNumber)

    yearHeaders.forEach((date, index) => {
      const raw = row.values[index + 1] ?? ''
      const parsed = parseAmount(raw)
      if (parsed === null) return
      if (parsed === 'invalid') {
        errors.push(`Row ${row.rowNumber}: "${raw}" for ${label} (${date}) isn't a number.`)
        columnsWithCellErrors.add(date)
        return
      }

      if (Math.abs(parsed) >= LARGEST_STORABLE) {
        errors.push(`Row ${row.rowNumber}: ${label} (${date}) is too big. Check the number, or enter the figures in thousands or millions.`)
        columnsWithCellErrors.add(date)
        return
      }

      const value = COST_KEYS.has(target.key) ? Math.abs(parsed) : parsed

      if (value < 0 && NEVER_NEGATIVE.has(target.key)) {
        const hint = target.key === 'cash' ? ' An overdraft goes under liabilities, not as negative cash.' : ''
        errors.push(`Row ${row.rowNumber}: ${label} can't be negative (${raw} in ${date}).${hint}`)
        columnsWithCellErrors.add(date)
        return
      }
      const year = years.get(date)!

      if (target.kind === 'line') {
        year.lines[target.key] = value
        return
      }

      let stream = year.streams.find((candidate) => candidate.name === target.name)
      if (!stream) {
        stream = { name: target.name, revenue: 0, directCosts: null }
        year.streams.push(stream)
      }
      if (target.key === 'segment_revenue') stream.revenue = value
      else stream.directCosts = value
    })
  }

  for (const year of years.values()) {
    const hasFigures = Object.keys(year.lines).length > 0 || year.streams.length > 0
    if (!hasFigures && !columnsWithCellErrors.has(year.fiscalYearEnd)) errors.push(`The ${year.fiscalYearEnd} column is empty.`)

    for (const stream of year.streams) {
      const hasRevenueRow = seenAt.has(`segment_revenue:${stream.name.toLowerCase()}`)
      if (!hasRevenueRow) {
        errors.push(`"Direct costs: ${stream.name}" needs a matching "Revenue stream: ${stream.name}" row.`)
      }
    }
  }

  if (seenAt.size === 0) {
    errors.push('None of the rows were recognised. Use the line names from the template, like "Revenue" or "Total assets".')
  }

  if (errors.length > 0) return { years: [], unrecognised, errors: [...new Set(errors)] }

  return {
    years: [...years.values()].sort((a, b) => b.fiscalYearEnd.localeCompare(a.fiscalYearEnd)),
    unrecognised,
    errors: [],
  }
}
