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

export interface StatementTableRow {
  key: StatementLineKey
  label: string
  values: Array<number | null>
  isCost: boolean
}

export function statementTableRows(years: StatementYear[]): StatementTableRow[] {
  const rows: StatementTableRow[] = []

  const companyKeys = STATEMENT_LINE_KEYS.filter(
    (key): key is CompanyLineKey => key !== 'segment_revenue' && key !== 'segment_direct_costs'
  )
  for (const key of companyKeys) {
    if (years.every((year) => year.lines[key] === undefined)) continue
    rows.push({
      key,
      label: STATEMENT_LINE_LABELS[key],
      values: years.map((year) => year.lines[key] ?? null),
      isCost: COST_KEYS.has(key),
    })
  }

  const streamNames = [...new Set(years.flatMap((year) => year.streams.map((stream) => stream.name)))]
  for (const name of streamNames) {
    const streamIn = (year: StatementYear) => year.streams.find((stream) => stream.name === name)
    rows.push({
      key: 'segment_revenue',
      label: `Revenue stream: ${name}`,
      values: years.map((year) => streamIn(year)?.revenue ?? null),
      isCost: false,
    })
    if (years.some((year) => streamIn(year)?.directCosts != null)) {
      rows.push({
        key: 'segment_direct_costs',
        label: `Direct costs: ${name}`,
        values: years.map((year) => streamIn(year)?.directCosts ?? null),
        isCost: true,
      })
    }
  }

  return rows
}

function amount(value: number | null, isCost: boolean) {
  if (value === null) return ''
  return isCost ? `(${Math.abs(value)})` : String(value)
}

export function buildStatementTemplate(years: StatementYear[]) {
  const rows: string[][] = [
    ['Line', ...years.map((year) => year.fiscalYearEnd)],
    ...statementTableRows(years).map((row) => [row.label, ...row.values.map((value) => amount(value, row.isCost))]),
  ]

  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}
export function buildBlankTemplate() {
  const headings = ['Line', 'Latest year end (e.g. 31 Mar 2025 or 2025-03-31)', 'Previous year end (e.g. 31 Mar 2024 or 2024-03-31)']
  const companyKeys = STATEMENT_LINE_KEYS.filter(
    (key): key is CompanyLineKey => key !== 'segment_revenue' && key !== 'segment_direct_costs'
  )
  const rows: string[][] = [
    headings,
    ...companyKeys.map((key) => [STATEMENT_LINE_LABELS[key], '', '']),
    ['Revenue stream: Stream name', '', ''],
    ['Direct costs: Stream name', '', ''],
  ]

  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}
