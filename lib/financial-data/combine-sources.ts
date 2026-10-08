import {
  FINANCIAL_METRIC_KEYS,
  FINANCIAL_METRIC_LABELS,
} from '@/lib/financial-data/metric-keys'
import type { FinancialMetricObservation } from '@/types/database'

export type CombinableObservation = Pick<
  FinancialMetricObservation,
  'metric_key' | 'value' | 'currency' | 'as_of_date' | 'period_start' | 'period_end' | 'source_label' | 'created_at'
>

export interface CombinedClash {
  metric: string
  date: string
  currency: string | null
  kept: { value: number; source: string }
  dropped: Array<{ value: number; source: string }>
}

export interface CombinedSources {
  csv: string
  rowCount: number
  sources: Array<{ label: string; figures: number; kept: number }>
  clashes: CombinedClash[]
  duplicatesMerged: number
  runwayRowsLeftOut: number
  warnings: string[]
}

const NEVER_NEGATIVE = new Set<CombinableObservation['metric_key']>([
  'cash',
  'accounts_receivable',
  'accounts_payable',
  'monthly_revenue',
  'monthly_expenses',
  'cost_of_sales',
  'current_assets',
  'current_liabilities',
  'total_debt',
])

function money(value: number, currency: string | null) {
  return `${currency ? `${currency} ` : ''}${value.toLocaleString('en-NZ')}`
}

function checkFigures(kept: CombinableObservation[]) {
  const warnings: string[] = []

  for (const row of kept) {
    if (row.value < 0 && NEVER_NEGATIVE.has(row.metric_key)) {
      warnings.push(
        `${FINANCIAL_METRIC_LABELS[row.metric_key]} is negative (${money(row.value, row.currency)}) on ${readableDate(dateOf(row))} in ${row.source_label}, but it can't be below zero.`
      )
    }
  }

  const sameMonth = new Map<string, Partial<Record<CombinableObservation['metric_key'], CombinableObservation>>>()
  for (const row of kept) {
    const key = [row.source_label, dateOf(row), row.currency ?? ''].join('|')
    sameMonth.set(key, { ...(sameMonth.get(key) ?? {}), [row.metric_key]: row })
  }
  for (const group of sameMonth.values()) {
    const { burn_rate: burn, monthly_revenue: revenue, monthly_expenses: expenses } = group
    if (!burn || !revenue || !expenses) continue
    const expected = expenses.value - revenue.value
    if (Math.abs(burn.value - expected) > Math.max(1, Math.abs(expected) * 0.01)) {
      warnings.push(
        `Burn rate is ${money(burn.value, burn.currency)} on ${readableDate(dateOf(burn))} in ${burn.source_label}, but monthly expenses − monthly revenue = ${money(expected, burn.currency)}.`
      )
    }
  }

  return warnings
}

const METRIC_ORDER = new Map(FINANCIAL_METRIC_KEYS.map((key, index) => [key, index]))

function day(value: string | null) {
  return value ? value.slice(0, 10) : ''
}

function dateOf(row: CombinableObservation) {
  return day(row.as_of_date) || day(row.period_end) || day(row.period_start)
}

function sameValue(a: number, b: number) {
  return Math.abs(a - b) < 1e-9
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function combineSources(rows: CombinableObservation[]): CombinedSources {
  const runwayRowsLeftOut = rows.filter((row) => row.metric_key === 'runway_months').length
  const figures = rows.filter((row) => row.metric_key !== 'runway_months')

  // One group per item, date, period and currency: the same thing reported twice.
  const groups = new Map<string, CombinableObservation[]>()
  for (const row of figures) {
    const key = [row.metric_key, day(row.as_of_date), day(row.period_start), day(row.period_end), row.currency ?? ''].join('|')
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const kept: CombinableObservation[] = []
  const clashes: CombinedClash[] = []
  let duplicatesMerged = 0

  for (const group of groups.values()) {
    const newestFirst = [...group].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const [winner, ...others] = newestFirst
    kept.push(winner)

    const differing = others.filter((other) => !sameValue(other.value, winner.value))
    duplicatesMerged += others.length - differing.length
    if (differing.length > 0) {
      clashes.push({
        metric: FINANCIAL_METRIC_LABELS[winner.metric_key],
        date: dateOf(winner),
        currency: winner.currency,
        kept: { value: winner.value, source: winner.source_label },
        dropped: differing.map((other) => ({ value: other.value, source: other.source_label })),
      })
    }
  }

  kept.sort(
    (a, b) =>
      dateOf(a).localeCompare(dateOf(b)) ||
      (METRIC_ORDER.get(a.metric_key) ?? 0) - (METRIC_ORDER.get(b.metric_key) ?? 0) ||
      a.source_label.localeCompare(b.source_label)
  )

  const hasPeriods = kept.some((row) => row.period_start || row.period_end)
  const lines = [
    ['Metric', 'Amount', 'Currency', 'Date', ...(hasPeriods ? ['Period start', 'Period end'] : []), 'Source'],
    ...kept.map((row) => [
      FINANCIAL_METRIC_LABELS[row.metric_key],
      String(row.value),
      row.currency ?? '',
      day(row.as_of_date),
      ...(hasPeriods ? [day(row.period_start), day(row.period_end)] : []),
      row.source_label,
    ]),
  ]

  const labels = [...new Set(figures.map((row) => row.source_label))].sort()
  return {
    csv: lines.map((line) => line.map(csvCell).join(',')).join('\n') + '\n',
    rowCount: kept.length,
    sources: labels.map((label) => ({
      label,
      figures: figures.filter((row) => row.source_label === label).length,
      kept: kept.filter((row) => row.source_label === label).length,
    })),
    clashes,
    duplicatesMerged,
    runwayRowsLeftOut,
    warnings: checkFigures(kept),
  }
}

/** A plain summary for the chat, with the download link. */
export function describeCombinedSources(combined: CombinedSources, downloadPath: string) {
  if (combined.rowCount === 0) {
    return 'There are no confirmed figures to combine yet. Upload a file in the Documents tab and confirm its figures first.'
  }

  const lines = [
    `Combined ${combined.rowCount} figures from ${combined.sources.length} source${combined.sources.length === 1 ? '' : 's'} into one CSV:`,
    ...combined.sources.map((source) => `- ${source.label}: ${source.figures} figures (${source.kept} kept)`),
    '',
    combined.clashes.length === 0
      ? 'No clashes: no two sources gave different figures for the same item and date.'
      : `Clashes (${combined.clashes.length}), where the most recently uploaded figure was kept:`,
    ...combined.clashes.map(
      (clash) =>
        `- ${clash.metric}, ${clash.date}: kept ${money(clash.kept.value, clash.currency)} from ${clash.kept.source}; dropped ${clash.dropped
          .map((item) => `${money(item.value, clash.currency)} from ${item.source}`)
          .join(', ')}`
    ),
  ]
  if (combined.warnings.length > 0) {
    lines.push(
      '',
      `Worth checking (${combined.warnings.length}): these figures look wrong. They were copied as they are, so fix the original file if needed:`,
      ...combined.warnings.map((warning) => `- ${warning}`),
      ''
    )
  }
  if (combined.duplicatesMerged > 0) lines.push(`Identical figures found in more than one source were kept once (${combined.duplicatesMerged}).`)
  if (combined.runwayRowsLeftOut > 0) lines.push(`Runway rows were left out (${combined.runwayRowsLeftOut}), because AI-BOSS recalculates runway from cash and burn.`)
  lines.push('', `[Download combined CSV](${downloadPath})`)
  return lines.join('\n')
}

export interface CombinableSource {
  label: string
  figures: number
  firstDate: string
  lastDate: string
}

export function listCombinableSources(rows: CombinableObservation[]): CombinableSource[] {
  const figures = rows.filter((row) => row.metric_key !== 'runway_months')
  const labels = [...new Set(figures.map((row) => row.source_label))].sort()
  return labels.map((label) => {
    const dates = figures.filter((row) => row.source_label === label).map(dateOf).filter(Boolean).sort()
    return {
      label,
      figures: figures.filter((row) => row.source_label === label).length,
      firstDate: dates[0] ?? '',
      lastDate: dates[dates.length - 1] ?? '',
    }
  })
}

export function rowsFromSources(rows: CombinableObservation[], chosen: string[]) {
  const wanted = new Set(chosen.map((label) => label.trim().toLowerCase()))
  return rows.filter((row) => wanted.has(row.source_label.toLowerCase()))
}

function readableDate(value: string) {
  return value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'no date'
}

/** The question asked before combining, so the user picks the files. */
export function describeAvailableSources(sources: CombinableSource[]) {
  if (sources.length === 0) {
    return 'There are no confirmed figures to combine yet. Upload a file in the Documents tab and confirm its figures first.'
  }
  if (sources.length === 1) {
    return `You only have one file with confirmed figures (${sources[0].label}), so there is nothing to combine yet. Upload another file in the Documents tab first.`
  }
  return [
    'Which files should I combine?',
    '',
    ...sources.map((source, index) => {
      const dates = source.firstDate === source.lastDate
        ? readableDate(source.firstDate)
        : `${readableDate(source.firstDate)} to ${readableDate(source.lastDate)}`
      return `${index + 1}. ${source.label} (${source.figures} ${source.figures === 1 ? 'figure' : 'figures'}, ${dates})`
    }),
    '',
    'Reply with the numbers (for example "1 and 3"), the file names, or "all".',
  ].join('\n')
}

/** The download address for the chosen files; no list means every file. */
export function combinedCsvPath(basePath: string, chosen: string[] | null) {
  if (!chosen || chosen.length === 0) return basePath
  return `${basePath}?${chosen.map((label) => `source=${encodeURIComponent(label)}`).join('&')}`
}
