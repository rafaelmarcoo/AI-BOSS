import type { ParsedCsvData, ParsedCsvRow } from '@/lib/documents/types'
import {
  resolveItemValue,
  toAttributeValue,
  type ExtractedItem,
  type ItemAttributes,
} from '@/lib/financial-data/attributes'
import { ADDITIVE_METRIC_KEYS } from '@/lib/financial-data/extraction/additive-metric-keys'
import type {
  AvailableFinancialMetricValue,
  FinancialMetricKey,
} from '@/lib/financial-data'

const LABEL_COLUMN_CANDIDATES = [
  'metric',
  'name',
  'label',
  'account',
  'account name',
  'description',
  'category',
  'item',
  'item name',
  'product',
  'product name',
]

const AMOUNT_COLUMN_CANDIDATES = [
  'value',
  'amount',
  'balance',
  'total',
  'closing balance',
]

const CURRENCY_COLUMN_CANDIDATES = ['currency', 'ccy']
const AS_OF_COLUMN_CANDIDATES = ['as of', 'as_of_date', 'date', 'snapshot date']
const PERIOD_START_COLUMN_CANDIDATES = ['period start', 'period_start']
const PERIOD_END_COLUMN_CANDIDATES = ['period end', 'period_end', 'period']

interface MetricLabelMatch {
  key: FinancialMetricKey
  confidence: number
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findHeader(headers: string[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeText)

  return headers.find((header) =>
    normalizedCandidates.includes(normalizeText(header))
  )
}

function parseNumber(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  const isNegative = /^\(.*\)$/.test(normalized)
  const withoutDecorators = normalized
    .replace(/[,$£€¥]/g, '')
    .replace(/[A-Z]{3}/gi, '')
    .replace(/[()]/g, '')
    .trim()

  // Text made only of decorators (e.g. "egg" or "NZD") is not a number;
  // Number('') would otherwise read it as 0.
  if (!withoutDecorators) {
    return null
  }

  const parsed = Number(withoutDecorators)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return isNegative ? -parsed : parsed
}

function readCell(row: ParsedCsvRow, header: string | undefined) {
  return header ? row.cells[header]?.trim() ?? '' : ''
}

function normalizeCurrency(value: string) {
  const currency = value.trim().toUpperCase()

  return /^[A-Z]{3}$/.test(currency) ? currency : null
}

function normalizeDate(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

function matchMetricLabel(value: string): MetricLabelMatch | null {
  const label = normalizeText(value)

  if (!label) {
    return null
  }

  // Check the specific burn labels before the broader "cash" label so that
  // "cash burn" is never stored as a cash-balance observation.
  if (/\b(burn rate|monthly burn|cash burn)\b/.test(label)) {
    return { key: 'burn_rate', confidence: 0.9 }
  }

  if (/\b(cash|bank balance|cash at bank|cash balance)\b/.test(label)) {
    return { key: 'cash', confidence: 0.95 }
  }

  if (
    /\b(accounts receivable|account receivable|receivables|debtors|ar)\b/.test(
      label
    )
  ) {
    return { key: 'accounts_receivable', confidence: 0.95 }
  }

  if (
    /\b(accounts payable|account payable|payables|creditors|ap)\b/.test(label)
  ) {
    return { key: 'accounts_payable', confidence: 0.95 }
  }

  if (/\b(monthly revenue|revenue|income|sales|turnover)\b/.test(label)) {
    return { key: 'monthly_revenue', confidence: 0.85 }
  }

  if (
    /\b(monthly expenses|expenses|operating expenses|opex|costs)\b/.test(label)
  ) {
    return { key: 'monthly_expenses', confidence: 0.85 }
  }

  if (/\b(runway|runway months)\b/.test(label)) {
    return { key: 'runway_months', confidence: 0.9 }
  }

  return null
}

export interface CsvExtractionResult {
  metrics: AvailableFinancialMetricValue[]
  // Rows whose label didn't match any known metric — same free-form bucket
  // image extraction already uses for labels like "Icecream Revenue" that
  // don't map onto the fixed metric_key enum.
  customMetrics: Record<string, number>
  // Every numeric row, in file order, with the row's extra columns as
  // attributes. The same label can appear more than once (Icecream in two
  // departments), so this list, not customMetrics, is the complete record.
  items: ExtractedItem[]
  // First-occurrence view of each item's attributes, keyed by label.
  itemAttributes: Record<string, ItemAttributes>
}

interface AccumulatedMetric {
  key: FinancialMetricKey
  value: number
  currency: string | null
  periodStart: string | null
  periodEnd: string | null
  asOfDate: string | null
  confidence: number
  excerpts: string[]
  rowStart: number
  rowEnd: number
}

// The full result: metrics plus items/attributes. Used by our own
// process.ts, which wants all of it from one pass over the rows.
export function extractCsvFinancialData(params: {
  csvData: ParsedCsvData
  documentId: string
  sourceLabel: string
  defaultCurrency?: string | null
  extractedAt: string
}): CsvExtractionResult {
  const labelHeader = findHeader(params.csvData.headers, LABEL_COLUMN_CANDIDATES)
  const amountHeader = findHeader(
    params.csvData.headers,
    AMOUNT_COLUMN_CANDIDATES
  )

  // Without an amount column a row can still have a value if it carries a
  // price and a quantity (price x quantity), so only the label is required.
  if (!labelHeader) {
    return { metrics: [], customMetrics: {}, items: [], itemAttributes: {} }
  }

  const currencyHeader = findHeader(
    params.csvData.headers,
    CURRENCY_COLUMN_CANDIDATES
  )
  const asOfHeader = findHeader(params.csvData.headers, AS_OF_COLUMN_CANDIDATES)
  const periodStartHeader = findHeader(
    params.csvData.headers,
    PERIOD_START_COLUMN_CANDIDATES
  )
  const periodEndHeader = findHeader(
    params.csvData.headers,
    PERIOD_END_COLUMN_CANDIDATES
  )
  const defaultCurrency = params.defaultCurrency
    ? normalizeCurrency(params.defaultCurrency)
    : null

  // Every other column describes the row (department, price, quantity...).
  const knownHeaders = new Set(
    [
      labelHeader,
      amountHeader,
      currencyHeader,
      asOfHeader,
      periodStartHeader,
      periodEndHeader,
    ].filter((header): header is string => Boolean(header))
  )
  const attributeHeaders = params.csvData.headers.filter(
    (header) => header.trim() && !knownHeaders.has(header)
  )

  const accumulated = new Map<FinancialMetricKey, AccumulatedMetric>()
  const customMetrics: Record<string, number> = {}
  const items: ExtractedItem[] = []
  const itemAttributes: Record<string, ItemAttributes> = {}

  for (const row of params.csvData.rows) {
    const rawLabel = readCell(row, labelHeader)
    const rawAmount = readCell(row, amountHeader)
    const rowAttributes: ItemAttributes = {}

    for (const header of attributeHeaders) {
      const cell = readCell(row, header)

      if (cell) {
        rowAttributes[header.trim()] = toAttributeValue(cell)
      }
    }

    // A value in the amount column always wins. Only a missing amount column,
    // or an empty cell in it, falls back to price x quantity. A cell that has
    // text but is not a number (e.g. "egg") is left for the value-issue check.
    const amount = amountHeader ? parseNumber(rawAmount) : null
    const canCompute = !amountHeader || !rawAmount.trim()
    const resolved =
      amount === null && canCompute
        ? resolveItemValue({ value: null, attributes: rowAttributes })
        : { value: amount, attributes: rowAttributes }
    const value = resolved.value

    if (value === null) continue

    const match = matchMetricLabel(rawLabel)
    const label = rawLabel.trim()

    if (label) {
      items.push({ label, value, attributes: resolved.attributes })
    }

    if (!match) {
      // First occurrence wins; the full list above keeps every row.
      if (label && !(label in customMetrics)) {
        customMetrics[label] = value

        if (Object.keys(resolved.attributes).length > 0) {
          itemAttributes[label] = resolved.attributes
        }
      }
      continue
    }

    const currency =
      normalizeCurrency(readCell(row, currencyHeader)) ?? defaultCurrency
    const excerpt = amountHeader
      ? `${labelHeader}: ${rawLabel}; ${amountHeader}: ${rawAmount || value}`
      : `${labelHeader}: ${rawLabel}; computed: ${value}`
    const existing = accumulated.get(match.key)

    if (!existing) {
      accumulated.set(match.key, {
        key: match.key,
        value,
        currency,
        periodStart: normalizeDate(readCell(row, periodStartHeader)),
        periodEnd: normalizeDate(readCell(row, periodEndHeader)),
        asOfDate: normalizeDate(readCell(row, asOfHeader)),
        confidence: match.confidence,
        excerpts: [excerpt],
        rowStart: row.rowNumber,
        rowEnd: row.rowNumber,
      })
    } else if (ADDITIVE_METRIC_KEYS.has(match.key)) {
      existing.value += value
      existing.excerpts.push(excerpt)
      existing.rowEnd = row.rowNumber
    }
  }

  const metrics: AvailableFinancialMetricValue[] = [...accumulated.values()].map(
    (entry) =>
      ({
        status: 'available',
        key: entry.key,
        value: entry.value,
        currency: entry.currency,
        periodStart: entry.periodStart,
        periodEnd: entry.periodEnd,
        asOfDate: entry.asOfDate,
        provenance: {
          sourceType: 'document',
          sourceLabel: params.sourceLabel,
          sourceId: params.documentId,
          evidence: {
            documentId: params.documentId,
            sourceRowStart: entry.rowStart,
            sourceRowEnd: entry.rowEnd,
            excerpt: entry.excerpts.join(' | '),
          },
        },
        confidence: entry.confidence,
        updatedAt: params.extractedAt,
      }) satisfies AvailableFinancialMetricValue
  )

  return { metrics, customMetrics, items, itemAttributes }
}

// Kept as its own function, with the exact name and plain-array shape this
// module has always exported, so code that only wants the fixed metrics
// (main's document-review candidate builder) never has to know that items
// and attributes exist.
export function extractCsvFinancialMetrics(
  params: Parameters<typeof extractCsvFinancialData>[0]
): AvailableFinancialMetricValue[] {
  return extractCsvFinancialData(params).metrics
}

export interface CsvValueIssue {
  rowNumber: number
  label: string
  rawValue: string
}

/**
 * Finds rows where the label column was recognized as a known financial
 * metric but the amount column couldn't be parsed as a number (e.g. an
 * "Expenses" row with a value of "egg"). Distinct from rows that simply
 * don't match any known metric at all — those are not errors, just
 * unrecognized data.
 */
export function findCsvValueIssues(csvData: ParsedCsvData): CsvValueIssue[] {
  const labelHeader = findHeader(csvData.headers, LABEL_COLUMN_CANDIDATES)
  const amountHeader = findHeader(csvData.headers, AMOUNT_COLUMN_CANDIDATES)

  if (!labelHeader || !amountHeader) {
    return []
  }

  const issues: CsvValueIssue[] = []

  for (const row of csvData.rows) {
    const rawLabel = readCell(row, labelHeader)
    const rawValue = readCell(row, amountHeader)

    if (!rawValue) {
      continue
    }

    const match = matchMetricLabel(rawLabel)

    if (match && parseNumber(rawValue) === null) {
      issues.push({ rowNumber: row.rowNumber, label: rawLabel, rawValue })
    }
  }

  return issues
}
