import type { StatementYear } from '@/lib/company-analysis/statement-analysis'
import { statementTableRows } from '@/lib/company-analysis/statement-template'

export interface SavedComparison {
  changed: Map<string, number | null>
  newYears: string[]
  removedYears: string[]
  removedLines: Array<{ label: string; fiscalYearEnd: string; was: number }>
}

export function cellKey(label: string, fiscalYearEnd: string) {
  return `${label}|${fiscalYearEnd}`
}

function sameFigure(now: number | null, was: number | null) {
  if (now === null || was === null) return now === was
  return Math.abs(now - was) < 1e-9
}

export function compareWithSaved(fileYears: StatementYear[], savedYears: StatementYear[]): SavedComparison {
  const fileRows = statementTableRows(fileYears)
  const savedRows = statementTableRows(savedYears)
  const savedYearIndex = new Map(savedYears.map((year, index) => [year.fiscalYearEnd, index]))
  const fileYearEnds = new Set(fileYears.map((year) => year.fiscalYearEnd))

  const changed = new Map<string, number | null>()
  for (const row of fileRows) {
    const savedRow = savedRows.find((candidate) => candidate.label === row.label)
    fileYears.forEach((year, index) => {
      const savedIndex = savedYearIndex.get(year.fiscalYearEnd)
      if (savedIndex === undefined) return
      const was = savedRow?.values[savedIndex] ?? null
      if (!sameFigure(row.values[index], was)) changed.set(cellKey(row.label, year.fiscalYearEnd), was)
    })
  }

  const removedLines: SavedComparison['removedLines'] = []
  for (const savedRow of savedRows) {
    if (fileRows.some((row) => row.label === savedRow.label)) continue
    savedYears.forEach((year, index) => {
      const was = savedRow.values[index]
      if (was !== null && fileYearEnds.has(year.fiscalYearEnd)) {
        removedLines.push({ label: savedRow.label, fiscalYearEnd: year.fiscalYearEnd, was })
      }
    })
  }

  return {
    changed,
    newYears: fileYears.map((year) => year.fiscalYearEnd).filter((date) => !savedYearIndex.has(date)),
    removedYears: savedYears.map((year) => year.fiscalYearEnd).filter((date) => !fileYearEnds.has(date)),
    removedLines,
  }
}

function count(amount: number, singular: string, plural: string) {
  return `${amount} ${amount === 1 ? singular : plural}`
}

export function describeComparison(comparison: SavedComparison) {
  const parts = [
    comparison.changed.size > 0 ? `${count(comparison.changed.size, 'figure', 'figures')} changed` : null,
    comparison.newYears.length > 0 ? `${count(comparison.newYears.length, 'year', 'years')} added` : null,
    comparison.removedYears.length > 0
      ? `${count(comparison.removedYears.length, 'saved year is', 'saved years are')} not in this file`
      : null,
    comparison.removedLines.length > 0
      ? `${count(comparison.removedLines.length, 'saved figure is', 'saved figures are')} missing from this file`
      : null,
  ].filter((part): part is string => part !== null)

  if (parts.length === 0) return "No changes: this file matches what's saved."
  const sentence = parts.join(', ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`
}
