import type { ParsedCsvData, ParsedCsvRow } from '@/lib/documents/types'
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

  if (/\b(burn rate|monthly burn|cash burn)\b/.test(label)) {
    return { key: 'burn_rate', confidence: 0.9 }
  }

  if (/\b(runway|runway months)\b/.test(label)) {
    return { key: 'runway_months', confidence: 0.9 }
  }

  return null
}

export function extractCsvFinancialMetrics(params: {
  csvData: ParsedCsvData
  documentId: string
  sourceLabel: string
  defaultCurrency?: string | null
  extractedAt: string
}): AvailableFinancialMetricValue[] {
  const labelHeader = findHeader(params.csvData.headers, LABEL_COLUMN_CANDIDATES)
  const amountHeader = findHeader(
    params.csvData.headers,
    AMOUNT_COLUMN_CANDIDATES
  )

  if (!labelHeader || !amountHeader) {
    return []
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

  return params.csvData.rows.flatMap((row) => {
    const match = matchMetricLabel(readCell(row, labelHeader))
    const value = parseNumber(readCell(row, amountHeader))

    if (!match || value === null) {
      return []
    }

    const currency =
      normalizeCurrency(readCell(row, currencyHeader)) ?? defaultCurrency

    return [
      {
        status: 'available',
        key: match.key,
        value,
        currency,
        periodStart: normalizeDate(readCell(row, periodStartHeader)),
        periodEnd: normalizeDate(readCell(row, periodEndHeader)),
        asOfDate: normalizeDate(readCell(row, asOfHeader)),
        provenance: {
          sourceType: 'document',
          sourceLabel: params.sourceLabel,
          sourceId: params.documentId,
          evidence: {
            documentId: params.documentId,
            sourceRowStart: row.rowNumber,
            sourceRowEnd: row.rowNumber,
            excerpt: `${labelHeader}: ${readCell(row, labelHeader)}; ${amountHeader}: ${readCell(row, amountHeader)}`,
          },
        },
        confidence: match.confidence,
        updatedAt: params.extractedAt,
      } satisfies AvailableFinancialMetricValue,
    ]
  })
}
