import type { ParsedPdfPage } from '@/lib/documents/types'
import type {
  AvailableFinancialMetricValue,
  FinancialMetricKey,
} from '@/lib/financial-data'

interface MetricLabelMatch {
  key: FinancialMetricKey
  confidence: number
}

const CURRENCY_PATTERN = /\b(NZD|AUD|USD|GBP)\b/i
const REPORTING_DATE_PATTERN = /\b(?:as\s+at|as\s+of|statement\s+date|balance\s+date|report(?:ing)?\s+date|period\s+ended|for\s+the\s+month\s+ended)\b\s*[:\-]?\s*(.+)$/i
const ISO_DATE_PATTERN = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/
const DAY_FIRST_DATE_PATTERN = /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/
const NAMED_DATE_PATTERN = /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchMetricLabel(value: string): MetricLabelMatch | null {
  const label = normalizeText(value)
  if (!label) return null

  // Specific labels must be checked before broad labels such as cash.
  if (/\b(burn rate|monthly burn|cash burn|net burn)\b/.test(label)) {
    return { key: 'burn_rate', confidence: 0.85 }
  }
  if (/\b(runway|runway months)\b/.test(label)) {
    return { key: 'runway_months', confidence: 0.85 }
  }
  if (/\b(cash|bank balance|cash at bank|cash balance|cash and cash equivalents)\b/.test(label)) {
    return { key: 'cash', confidence: 0.85 }
  }
  if (/\b(accounts receivable|account receivable|receivables|debtors|ar)\b/.test(label)) {
    return { key: 'accounts_receivable', confidence: 0.85 }
  }
  if (/\b(accounts payable|account payable|payables|creditors|ap)\b/.test(label)) {
    return { key: 'accounts_payable', confidence: 0.85 }
  }
  if (/\b(monthly revenue|revenue|income|sales|turnover)\b/.test(label)) {
    return { key: 'monthly_revenue', confidence: 0.75 }
  }
  if (/\b(monthly expenses|expenses|operating expenses|opex|costs)\b/.test(label)) {
    return { key: 'monthly_expenses', confidence: 0.75 }
  }

  return null
}

function parseNumber(value: string) {
  const trimmed = value.trim()
  const isNegative = trimmed.startsWith('(') || /^[-−]/.test(trimmed)
  const normalized = trimmed
    .replace(/[,$£€¥()\s−-]/g, '')
    .replace(/[A-Z]{3}/gi, '')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? (isNegative ? -parsed : parsed) : null
}

function parseDate(value: string) {
  const iso = value.match(ISO_DATE_PATTERN)
  if (iso) {
    const [, year, month, day] = iso
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const dayFirst = value.match(DAY_FIRST_DATE_PATTERN)
  if (dayFirst) {
    const [, day, month, year] = dayFirst
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const named = value.match(NAMED_DATE_PATTERN)
  if (named) {
    const parsed = new Date(`${named[2]} ${named[1]}, ${named[3]} UTC`)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
  }

  return null
}

function findReportingDate(pages: ParsedPdfPage[]) {
  for (const page of pages) {
    for (const line of page.lines ?? page.text.split('\n')) {
      const context = line.match(REPORTING_DATE_PATTERN)
      if (!context) continue

      const date = parseDate(context[1])
      if (date) return date
    }
  }

  return null
}

function getPageLines(page: ParsedPdfPage) {
  return page.lines ?? page.text.split('\n')
}

export function extractPdfFinancialMetrics(params: {
  pages: ParsedPdfPage[]
  documentId: string
  sourceLabel: string
  extractedAt: string
}): AvailableFinancialMetricValue[] {
  const asOfDate = findReportingDate(params.pages)
  if (!asOfDate) return []

  const results: AvailableFinancialMetricValue[] = []
  const seenKeys = new Set<FinancialMetricKey>()
  const linePattern = /^(.+?)(?:\s*:\s*|\s+)(\(?\s*[-−]?\s*[$£€¥]?\s*[\d,]+(?:\.\d{1,2})?\s*\)?)(?:\s+([A-Z]{3}))?\s*$/

  for (const page of params.pages) {
    for (const rawLine of getPageLines(page)) {
      const line = rawLine.trim()
      const match = line.match(linePattern)
      if (!match) continue

      const [, label, rawValue, inlineCurrency] = match
      const metric = matchMetricLabel(label)
      const value = parseNumber(rawValue)
      if (!metric || value === null || seenKeys.has(metric.key)) continue

      seenKeys.add(metric.key)
      const currency = inlineCurrency?.toUpperCase() ?? line.match(CURRENCY_PATTERN)?.[1]?.toUpperCase() ?? null
      results.push({
        status: 'available',
        key: metric.key,
        value,
        currency,
        periodStart: null,
        periodEnd: null,
        asOfDate,
        provenance: {
          sourceType: 'document',
          sourceLabel: params.sourceLabel,
          sourceId: params.documentId,
          evidence: {
            documentId: params.documentId,
            sourcePage: page.pageNumber,
            excerpt: line,
          },
        },
        confidence: metric.confidence,
        updatedAt: params.extractedAt,
      })
    }
  }

  return results
}
