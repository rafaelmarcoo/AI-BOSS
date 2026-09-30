import {
  STATEMENT_LINE_KEYS,
  STATEMENT_LINE_LABELS,
  type StatementLineKey,
} from '@/lib/company-analysis/statement-lines'
import type { StatementYear } from '@/lib/company-analysis/statement-analysis'

type CompanyLineKey = Exclude<StatementLineKey, 'segment_revenue' | 'segment_direct_costs'>

const COST_KEYS = new Set<StatementLineKey>([
  'cost_of_sales',
  'marketing_expenses',
  'administrative_expenses',
  'total_operating_costs',
  'finance_costs',
  'tax_expense',
  'dividends',
])

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function amount(value: number | null | undefined, isCost: boolean) {
  if (value === null || value === undefined) return ''
  return isCost ? `(${Math.abs(value)})` : String(value)
}

export function buildStatementTemplate(years: StatementYear[]) {
  const rows: string[][] = [['Line', ...years.map((year) => year.fiscalYearEnd)]]

  const companyKeys = STATEMENT_LINE_KEYS.filter(
    (key): key is CompanyLineKey => key !== 'segment_revenue' && key !== 'segment_direct_costs'
  )
  for (const key of companyKeys) {
    if (years.every((year) => year.lines[key] === undefined)) continue
    rows.push([
      STATEMENT_LINE_LABELS[key],
      ...years.map((year) => amount(year.lines[key], COST_KEYS.has(key))),
    ])
  }

  const streamNames = [...new Set(years.flatMap((year) => year.streams.map((stream) => stream.name)))]
  for (const name of streamNames) {
    const streamIn = (year: StatementYear) => year.streams.find((stream) => stream.name === name)
    rows.push([`Revenue stream: ${name}`, ...years.map((year) => amount(streamIn(year)?.revenue, false))])
    if (years.some((year) => streamIn(year)?.directCosts != null)) {
      rows.push([`Direct costs: ${name}`, ...years.map((year) => amount(streamIn(year)?.directCosts, true))])
    }
  }

  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}
