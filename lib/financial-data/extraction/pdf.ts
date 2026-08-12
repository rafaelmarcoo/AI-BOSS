import type { ParsedPdfPage } from '@/lib/documents/types'
import type { AvailableFinancialMetricValue, FinancialMetricKey } from '@/lib/financial-data'

const LINE_PATTERN = /^(.+?)[\s:]+\$?([\d,]+(?:\.\d{1,2})?)(?:\s+([A-Z]{3}))?/

const CURRENCY_PATTERN = /\b(NZD|AUD|USD|GBP)\b/i

interface MetricMatch {
  key: FinancialMetricKey
  confidence: number
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchMetricLabel(raw: string): MetricMatch | null {
  const label = normalizeText(raw)

  if (!label) return null

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
  if (/\b(burn rate|monthly burn|cash burn)\b/.test(label)) {
    return { key: 'burn_rate', confidence: 0.85 }
  }
  if (/\b(runway|runway months)\b/.test(label)) {
    return { key: 'runway_months', confidence: 0.85 }
  }

  return null
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim()
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function detectCurrency(line: string, inlineCurrency?: string): string | null {
  if (inlineCurrency && /^[A-Z]{3}$/.test(inlineCurrency)) {
    return inlineCurrency.toUpperCase()
  }
  const match = CURRENCY_PATTERN.exec(line)
  return match ? match[1].toUpperCase() : null
}

export function extractPdfFinancialMetrics(params: {
  pages: ParsedPdfPage[]
  documentId: string
  sourceLabel: string
  defaultCurrency?: string | null
  extractedAt: string
}): AvailableFinancialMetricValue[] {
  const results: AvailableFinancialMetricValue[] = []
  const seenKeys = new Set<FinancialMetricKey>()

  for (const page of params.pages) {
    const lines = page.text.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const lineMatch = LINE_PATTERN.exec(line)
      if (!lineMatch) continue

      const [, labelPart, valuePart, inlineCurrency] = lineMatch
      const metricMatch = matchMetricLabel(labelPart)
      if (!metricMatch) continue

      // First occurrence wins: PDF may repeat values across pages
      if (seenKeys.has(metricMatch.key)) continue

      const value = parseNumber(valuePart)
      if (value === null) continue

      const currency =
        detectCurrency(line, inlineCurrency) ??
        (params.defaultCurrency ?? null)

      seenKeys.add(metricMatch.key)
      results.push({
        status: 'available',
        key: metricMatch.key,
        value,
        currency,
        periodStart: null,
        periodEnd: null,
        asOfDate: null,
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
        confidence: metricMatch.confidence,
        updatedAt: params.extractedAt,
      })
    }
  }

  return results
}
