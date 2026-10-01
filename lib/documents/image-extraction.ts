import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import { ApiError } from '@/lib/api/errors'
import {
  resolveItemValue,
  toItemAttributes,
  type ExtractedItem,
  type ItemAttributes,
} from '@/lib/financial-data/attributes'
import { ADDITIVE_METRIC_KEYS } from '@/lib/financial-data/extraction/additive-metric-keys'
import type {
  AvailableFinancialMetricValue,
  FinancialMetricKey,
} from '@/lib/financial-data'

const OPENAI_VISION_MODEL = 'gpt-4o'
// Every extracted value here is read by the vision model, not matched by a
// fixed pattern, so one flat confidence is used throughout — same idea as
// the LLM text extractor's MODEL_CONFIDENCE, not the tiered confidences the
// deterministic CSV/PDF matchers use.
const IMAGE_METRIC_CONFIDENCE = 0.7
const CURRENCY_PATTERN = /\b(NZD|AUD|USD|GBP)\b/i

const IMAGE_EXTRACTION_PROMPT =
  'Transcribe all readable text from this image exactly as it appears, ' +
  'preserving table structure using plain text alignment where possible. ' +
  'If the image contains a financial document (receipt, invoice, statement, ' +
  'ledger), also note the document type and any totals, dates, or line items ' +
  'you can identify. Do not summarize or omit content — transcribe everything visible.'

const IMAGE_METRICS_PROMPT =
  'Identify every financial figure in this image (expenses, revenue, totals, ' +
  'line items, department or category breakdowns, etc.). Respond with ONLY a JSON ' +
  'object, no markdown and no explanation, shaped as: {"items": [{"label": string, ' +
  '"value": string, "attributes": {"<column name>": string}}]}. Rules: ' +
  '(1) One item per row or line. "label" is a short, human-readable name copied ' +
  'from the image, for example "Icecream Revenue". ' +
  '(2) "value" is the figure exactly as written in the image, as a string, even if ' +
  'it does not look like a valid number (for example "egg"); do not skip it, ' +
  'correct it or guess at it. ' +
  '(3) If the row has other cells (department, category, price, quantity, colour, ' +
  'date...), put each in "attributes", using the column heading as the name and the ' +
  'cell text as the value. ' +
  '(4) If a row shows a price and a quantity but no total, set "value" to "" and put ' +
  'both in attributes; do not calculate the total yourself. ' +
  '(5) The same label may appear more than once (for example in two departments): ' +
  'keep every occurrence as its own item. ' +
  'If there are no financial figures, return {"items": []}.'

export interface ImageMetricIssue {
  label: string
  rawValue: string
}

export interface ImageMetricsResult {
  // Labels recognized as a known fixed metric (cash, monthly_revenue, ...),
  // shaped exactly like the CSV/PDF extractors' output. No reporting date is
  // read from images today, so every entry carries asOfDate: null — the same
  // ungated behaviour CSV already has, not PDF's stricter date gate.
  metrics: AvailableFinancialMetricValue[]
  // Everything else: labels that don't match a known metric. First
  // occurrence of each label wins, same convention as CSV/PDF.
  customMetrics: Record<string, number>
  issues: ImageMetricIssue[]
  // Every readable row, repeated labels and attributes included — matched
  // and unmatched labels alike, since the items matrix shows everything.
  items: ExtractedItem[]
  // First-occurrence view of each item's attributes, keyed by label.
  itemAttributes: Record<string, ItemAttributes>
}

export interface ImageMetricsContext {
  documentId: string
  sourceLabel: string
  extractedAt: string
}

function toNumeric(raw: string): number | null {
  // The currency code must be stripped before whitespace: once "4000 NZD"
  // becomes "4000NZD", the digit and the letter are both "word" characters,
  // so \b no longer finds a boundary in front of NZD and it stops matching.
  const withoutCurrency = raw.replace(CURRENCY_PATTERN, '')
  const cleaned = withoutCurrency.replace(/[,$£€¥\s]/g, '')

  if (!cleaned) {
    return null
  }

  const numeric = Number(cleaned)

  return Number.isFinite(numeric) ? numeric : null
}

function normalizeLabelText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Same label families as the CSV/PDF matchers (specific labels checked before
// the broad "cash" one, for the same reason: "cash burn" must never become a
// cash-balance observation). Kept as its own copy rather than a shared
// module — see the note where this is called.
function matchMetricLabel(value: string): FinancialMetricKey | null {
  const label = normalizeLabelText(value)
  if (!label) return null

  if (/\b(burn rate|monthly burn|cash burn|net burn)\b/.test(label)) return 'burn_rate'
  if (/\b(runway|runway months)\b/.test(label)) return 'runway_months'
  if (/\b(cash|bank balance|cash at bank|cash balance|cash and cash equivalents)\b/.test(label)) {
    return 'cash'
  }
  if (/\b(accounts receivable|account receivable|receivables|debtors|ar)\b/.test(label)) {
    return 'accounts_receivable'
  }
  if (/\b(accounts payable|account payable|payables|creditors|ap)\b/.test(label)) {
    return 'accounts_payable'
  }
  if (/\b(monthly revenue|revenue|income|sales|turnover)\b/.test(label)) return 'monthly_revenue'
  if (/\b(monthly expenses|expenses|operating expenses|opex|costs)\b/.test(label)) {
    return 'monthly_expenses'
  }

  return null
}

/**
 * Reads the model's reply. Accepts the item-list shape asked for by the
 * prompt and, for robustness, the older flat {"label": "value"} object.
 * Pure, so it can be tested without calling the model.
 */
export function parseImageMetricsJson(
  raw: string,
  context: ImageMetricsContext
): ImageMetricsResult {
  const empty: ImageMetricsResult = {
    metrics: [],
    customMetrics: {},
    issues: [],
    items: [],
    itemAttributes: {},
  }
  const jsonMatch = raw.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return empty
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return empty
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return empty
  }

  const record = parsed as Record<string, unknown>
  const entries: Array<{ label: string; value: unknown; attributes: unknown }> = Array.isArray(
    record.items
  )
    ? record.items
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object'
        )
        .map((entry) => ({
          label: typeof entry.label === 'string' ? entry.label : '',
          value: entry.value,
          attributes: entry.attributes,
        }))
    : Object.entries(record).map(([label, value]) => ({ label, value, attributes: undefined }))

  const customMetrics: Record<string, number> = {}
  const issues: ImageMetricIssue[] = []
  const items: ExtractedItem[] = []
  const itemAttributes: Record<string, ItemAttributes> = {}
  const accumulated = new Map<
    FinancialMetricKey,
    { value: number; currency: string | null; excerpts: string[] }
  >()

  for (const entry of entries) {
    const label = entry.label.trim()

    if (!label) continue

    const rawValue =
      typeof entry.value === 'number' && Number.isFinite(entry.value)
        ? String(entry.value)
        : entry.value === null || entry.value === undefined
          ? ''
          : String(entry.value).trim()
    const stated = rawValue ? toNumeric(rawValue) : null

    // Unreadable text such as "egg" is flagged for the user to correct
    // rather than dropped or guessed at.
    if (rawValue && stated === null) {
      issues.push({ label, rawValue })
      continue
    }

    // A value read from the image always wins; price x quantity only fills
    // in a row that had none.
    const resolved = resolveItemValue({
      value: stated,
      attributes: toItemAttributes(entry.attributes),
    })

    if (resolved.value === null) continue

    items.push({ label, value: resolved.value, attributes: resolved.attributes })

    const metricKey = matchMetricLabel(label)

    // First occurrence wins; the item list keeps every row regardless.
    if (!metricKey) {
      if (!(label in customMetrics)) {
        customMetrics[label] = resolved.value

        if (Object.keys(resolved.attributes).length > 0) {
          itemAttributes[label] = resolved.attributes
        }
      }
      continue
    }

    const currency = rawValue.match(CURRENCY_PATTERN)?.[1]?.toUpperCase() ?? null
    const excerpt = `${label}: ${rawValue || resolved.value}`
    const existing = accumulated.get(metricKey)

    if (!existing) {
      accumulated.set(metricKey, { value: resolved.value, currency, excerpts: [excerpt] })
    } else if (ADDITIVE_METRIC_KEYS.has(metricKey)) {
      existing.value += resolved.value
      existing.excerpts.push(excerpt)
    }
  }

  const metrics: AvailableFinancialMetricValue[] = [...accumulated.entries()].map(
    ([key, entry]) =>
      ({
        status: 'available',
        key,
        value: entry.value,
        currency: entry.currency,
        periodStart: null,
        periodEnd: null,
        asOfDate: null,
        provenance: {
          sourceType: 'document',
          sourceLabel: context.sourceLabel,
          sourceId: context.documentId,
          evidence: {
            documentId: context.documentId,
            excerpt: entry.excerpts.join(' | '),
          },
        },
        confidence: IMAGE_METRIC_CONFIDENCE,
        updatedAt: context.extractedAt,
      }) satisfies AvailableFinancialMetricValue
  )

  return { metrics, customMetrics, issues, items, itemAttributes }
}

export async function extractImageText(
  fileBytes: Uint8Array,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  const model = new ChatOpenAI({ model: OPENAI_VISION_MODEL, temperature: 0, apiKey })
  const base64Data = Buffer.from(fileBytes).toString('base64')

  const response = await model.invoke([
    new HumanMessage({
      content: [
        { type: 'text', text: IMAGE_EXTRACTION_PROMPT },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Data}` },
        },
      ],
    }),
  ])

  return typeof response.content === 'string' ? response.content.trim() : ''
}

export async function extractImageMetrics(
  fileBytes: Uint8Array,
  mimeType: string,
  context: ImageMetricsContext
): Promise<ImageMetricsResult> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  const model = new ChatOpenAI({ model: OPENAI_VISION_MODEL, temperature: 0, apiKey })
  const base64Data = Buffer.from(fileBytes).toString('base64')

  const response = await model.invoke([
    new HumanMessage({
      content: [
        { type: 'text', text: IMAGE_METRICS_PROMPT },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Data}` },
        },
      ],
    }),
  ])

  const raw = typeof response.content === 'string' ? response.content : ''
  return parseImageMetricsJson(raw, context)
}
