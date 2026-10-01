import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ApiError } from '@/lib/api/errors'
import type {
  AvailableFinancialMetricValue,
  FinancialMetricKey,
} from '@/lib/financial-data'
import {
  resolveItemValue,
  toItemAttributes,
  type ExtractedItem,
  type ItemAttributes,
} from '@/lib/financial-data/attributes'
import { ADDITIVE_METRIC_KEYS } from '@/lib/financial-data/extraction/additive-metric-keys'
import {
  FINANCIAL_METRIC_KEYS,
  isFinancialMetricKey,
} from '@/lib/financial-data/metric-keys'

// Same model the chat already runs on, so it is known to work with this key.
const TEXT_EXTRACTION_MODEL = 'gpt-4o-mini-2024-07-18'
// The document is read in small pieces because the model skims long inputs
// and stops listing lines early. A page is about 1.5k characters.
const MIN_SEGMENT_CHARS = 3
const MAX_SEGMENT_CHARS = 6_000
// Caps the number of calls (and so cost) on very long documents.
const MAX_SEGMENTS = 60
// Each page makes two calls (tables, then prose), so 3 pages = 6 calls at once.
const SEGMENT_CONCURRENCY = 3
const IDENTIFY_INPUT_CHARS = 8_000
// Lower than the deterministic extractors (0.75 to 0.95): model output is
// less predictable than a fixed pattern match.
const MODEL_CONFIDENCE = 0.7

const TEXT_EXTRACTION_PROMPT =
  'You extract structured financial data from the text of a document. ' +
  'Respond with ONLY a JSON object, no markdown and no explanation, shaped as: ' +
  '{"primaryEntity": string|null, "asOfDate": "YYYY-MM-DD"|null, ' +
  '"currency": "NZD"|null, "items": [{"label": string, "value": number|null, ' +
  `"metric": one of [${FINANCIAL_METRIC_KEYS.join(', ')}] or null, ` +
  '"entity": string|null, "period": "annual"|"monthly"|"point_in_time"|null, ' +
  '"attributes": {"<name>": string|number}}]}. Rules: ' +
  '(1) "primaryEntity" is the company the document is mainly about. Extract the figures ' +
  'of EVERY company that has its own figures (competitors and peers included) and set ' +
  '"entity" on each item to the company it belongs to, or null if the document only ' +
  'covers one company. ' +
  '(2) Where a table has several period columns, use only the most recent one. Set ' +
  '"period" to "annual" for a figure covering a whole year, "monthly" for one month, ' +
  '"point_in_time" for a balance at a date (such as a balance sheet), or null if unclear. ' +
  'For an annual or monthly figure also add an attribute "period" giving the period as ' +
  'printed, for example "year ended 31 March 2025". ' +
  '(3) Give values as plain numbers exactly as printed (no currency symbols, ' +
  'no thousands separators, do not convert units); numbers in parentheses are negative. ' +
  '(4) "label" must be the item\'s own wording copied exactly as written in the ' +
  'document, for example "Trade and other receivables" or "Icecream Revenue". ' +
  'Never use a metric name as a label. The same label may appear more than once ' +
  '(for example in different departments, or in two different statements): keep every ' +
  'occurrence as its own item and put what tells them apart into "attributes", for ' +
  'example {"department": "A"} or {"statement": "Profit or loss"}. ' +
  'A parenthesised cost or expense line only means it is deducted, so give costs and ' +
  'expenses as positive numbers; a parenthesised profit, loss or balance is negative. ' +
  '(5) List EVERY line item that has its own figure, not only the ones that match a ' +
  'metric. That includes cost of sales, gross profit, operating profit, finance costs, ' +
  'tax, inventory, loans and similar lines, and subtotals. Skip column headings, ' +
  'years and page numbers. In a table with several value columns (for example share ' +
  'capital, retained earnings, total), give each cell its own item and put the column ' +
  'name in "attributes" as {"column": "Retained earnings"}. ' +
  '(6) Set "metric" only when the item clearly is that metric: cash (cash or bank balance), ' +
  'accounts_receivable, accounts_payable, monthly_revenue (revenue, sales, income), ' +
  'monthly_expenses, burn_rate, runway_months. Balance-sheet wording: "Bank", "Cash at ' +
  'bank" and "Cash and cash equivalents" are cash; "Trade and other receivables", "Trade ' +
  'debtors" and "Debtors" are accounts_receivable; "Trade and other payables", "Trade ' +
  'creditors" and "Creditors" are accounts_payable. monthly_revenue and monthly_expenses are ' +
  'only for figures covering ONE month: a yearly figure gets "period": "annual" and ' +
  '"metric": null. Definitions: accounts_receivable is only ' +
  'money owed TO the business by customers (trade receivables, debtors); accounts_payable ' +
  'is only money the business owes to suppliers (trade payables, creditors). ' +
  'Inventory, stock, property, equipment, intangibles, loans, equity, share capital, ' +
  'retained earnings and tax lines are NEVER any of these metrics. Otherwise null, for example ' +
  '{"label": "Gross profit", "value": 56.9, "metric": null}. Never assign a subtotal ' +
  'such as gross profit, operating profit or total assets to a metric. ' +
  '(7) Put any other fields on the same row into "attributes" (for example price, ' +
  'quantity, department). If a row gives a unit price and a quantity but no total, ' +
  'set value to null, include both in attributes, and do not calculate the total yourself. ' +
  '(8) asOfDate is the reporting or period-end date, or null if it is not stated. ' +
  '(9) Also go through the ordinary sentences one by one and list EVERY number that ' +
  'describes a business or its market: headcounts, percentages ("80% of deliveries ' +
  'use electric vehicles" is "Deliveries using electric vehicles": 80 %), emissions, ' +
  'tonnes, durations ("support continues for 3 months" is "Technical support period": ' +
  '3 months), minimum quantities ("at least 50 units" is "Minimum bulk purchase": 50 ' +
  'units), opening hours, prices and founding years. Do not skip a sentence because ' +
  'it seems minor. Label them by what they measure (for example ' +
  '"Staff employed" or "Reduction in CO2e emissions"; the label is a short noun phrase, ' +
  'never a sentence fragment), give the number only, put the ' +
  'unit in "attributes" as {"unit": "staff"} or {"unit": "%"}, and set metric to null. ' +
  'Skip page numbers, dates, section numbers and any number with no clear subject. ' +
  'If there is nothing to extract, return {"items": []}.'

// A second, narrower pass over the same page. Facts stated in prose get missed
// when the model is also busy listing table rows, so they get their own call.
const NARRATIVE_PROMPT =
  'You extract facts stated in the ordinary sentences of a document. Respond with ONLY a ' +
  'JSON object, no markdown: {"items": [{"label": string, "value": number, "entity": ' +
  'string|null, "attributes": {"unit": string}}]}. Go through the text sentence by sentence ' +
  'and list EVERY number that describes a business, its operations or its market: ' +
  'headcounts, percentages, emissions, tonnes, durations, minimum quantities, opening ' +
  'hours, prices, capacities and founding years. Example: "80% of deliveries use electric ' +
  'vehicles" gives {"label": "Deliveries using electric vehicles", "value": 80, ' +
  '"entity": "Ressett", "attributes": {"unit": "%"}}. The label is a short noun phrase ' +
  'describing what the number measures, never a sentence fragment. "value" is the number ' +
  'only and "unit" is what it counts or measures. "entity" is the company the fact is ' +
  'about, or null. IGNORE tables, statement lines and column headings, and skip page ' +
  'numbers, section numbers, dates, and any number with no clear subject. If there is ' +
  'nothing, return {"items": []}.'

const IDENTIFY_PROMPT =
  'Read the opening of a document. Respond with ONLY a JSON object, no markdown: ' +
  '{"primaryEntity": string|null, "currency": "NZD"|null}. primaryEntity is the company ' +
  'the document is mainly about or written from the perspective of (for example the ' +
  'employer of the reader, or the company whose report it is), NOT a competitor or peer ' +
  'that is only mentioned. currency is the 3-letter code only if one is clearly stated.'

export interface TextExtractionContext {
  documentId: string
  sourceLabel: string
  extractedAt: string
}

export interface TextExtractionResult {
  // Fixed metrics. Empty when the document gave no clear reporting date,
  // same trend-safety rule as the deterministic PDF extractor.
  metrics: AvailableFinancialMetricValue[]
  // The complete list of extracted items, duplicates included (including
  // ones that also feed a fixed metric, so their individual detail stays
  // visible). This is the source of truth for anything item-level.
  items: ExtractedItem[]
  // Simple label -> value view kept for the screens that read
  // documents.metadata.extractedMetrics today. A repeated label keeps its
  // FIRST occurrence and is never overwritten; the full list is in `items`.
  customMetrics: Record<string, number>
  // Same first-occurrence view of each item's attributes, keyed by label.
  itemAttributes: Record<string, ItemAttributes>
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const cleaned = value.replace(/[,$£€¥\s]/g, '')

  if (!cleaned) {
    return null
  }

  const parsed = Number(cleaned)

  return Number.isFinite(parsed) ? parsed : null
}

function toAsOfDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  return Number.isNaN(new Date(value).getTime()) ? null : value
}

function toCurrency(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim())
    ? value.trim().toUpperCase()
    : null
}

function toEntity(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// "Ressett Group", "Ressett Ltd" and "RESSETT" are the same company.
function entityKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(group|holdings|ltd|limited|inc|plc|co|company|llc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sameEntity(a: string, b: string) {
  return entityKey(a) === entityKey(b)
}

// The two fixed metrics that only make sense for a single month.
const MONTHLY_ONLY_METRIC_KEYS = new Set<FinancialMetricKey>([
  'monthly_revenue',
  'monthly_expenses',
])

interface AccumulatedMetric {
  value: number
  excerpts: string[]
}

type ModelResponse = Record<string, unknown> & { items: unknown[] }

// Pulls the JSON object out of a model reply (tolerating text or code fences
// around it). Null when there is no object with an `items` array.
function readModelResponse(raw: string): ModelResponse | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  const response = parsed as Record<string, unknown>

  return Array.isArray(response.items) ? (response as ModelResponse) : null
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>()

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  let best: string | null = null

  for (const [value, count] of counts) {
    // On a tie the later value wins: later dates are the more recent period.
    if (best === null || count >= (counts.get(best) ?? 0)) {
      best = value
    }
  }

  return best
}

/**
 * Combines the replies from the per-page calls into one response: every item
 * from every page, plus the most common date, currency and primary entity.
 * `primaryEntityHint` (from the opening pages) wins over what individual pages
 * guessed, because a page about a competitor can look like it is about it.
 * Pure. Null when no reply was usable.
 */
export function combineSegmentReplies(
  rawReplies: string[],
  primaryEntityHint: string | null = null,
  narrativeReplies: string[] = []
): ModelResponse | null {
  const responses = rawReplies
    .map(readModelResponse)
    .filter((response): response is ModelResponse => response !== null)

  if (responses.length === 0) {
    return null
  }

  // The narrative pass often re-finds something the table pass already listed
  // (sometimes with different wording, and it also tends to re-read table
  // rows). Drop a narrative item when an item with the same value and company
  // already exists. Rare downside: a prose number that coincides exactly with
  // a table number of the same company is dropped here; it stays searchable
  // in the chat through the document text. Prose items need a unit, which
  // also filters out stray numbers with no clear subject.
  const factKey = (item: unknown) => {
    const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const value = toNumber(entry.value)

    return value !== null ? `${value}|${entityKey(toEntity(entry.entity))}` : null
  }
  const unitOf = (item: unknown) => {
    const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const unit = toItemAttributes(entry.attributes).unit

    return typeof unit === 'string' ? unit.toLowerCase() : ''
  }
  const tableFacts = new Set(
    responses.flatMap((response) => response.items.map(factKey)).filter(Boolean)
  )
  // Among themselves, two prose facts are the same only if the unit matches
  // too ("5%" and "5 times" are different facts).
  const seenProse = new Set<string>()
  const narrativeItems = narrativeReplies
    .map(readModelResponse)
    .flatMap((response) => response?.items ?? [])
    .filter((item) => {
      const key = factKey(item)
      const unit = unitOf(item)

      if (!key || !unit || tableFacts.has(key) || seenProse.has(`${key}|${unit}`)) return false

      seenProse.add(`${key}|${unit}`)
      return true
    })

  const dates = responses
    .map((response) => toAsOfDate(response.asOfDate))
    .filter((value): value is string => value !== null)
    .sort()
  const currencies = responses
    .map((response) => toCurrency(response.currency))
    .filter((value): value is string => value !== null)
  const entities = responses.map((response) => toEntity(response.primaryEntity)).filter(Boolean)

  return {
    primaryEntity: primaryEntityHint || mostCommon(entities),
    asOfDate: mostCommon(dates),
    currency: mostCommon(currencies),
    items: [...responses.flatMap((response) => response.items), ...narrativeItems],
  }
}

/**
 * Turns the model's raw JSON reply into our extraction shape. Pure, so it can
 * be tested without calling the model. Returns null when the reply is not
 * usable JSON, which callers treat as "fall back to the regex extractor".
 */
export function parseTextExtractionResponse(
  raw: string,
  context: TextExtractionContext
): TextExtractionResult | null {
  const response = readModelResponse(raw)

  return response ? buildExtractionResult(response, context) : null
}

function buildExtractionResult(
  response: ModelResponse,
  context: TextExtractionContext
): TextExtractionResult {
  const asOfDate = toAsOfDate(response.asOfDate)
  const currency = toCurrency(response.currency)
  const primaryEntity = toEntity(response.primaryEntity)
  // First spelling seen for each company, so "Fixxupp" and "Fixxupp Group" are
  // stored under one name.
  const entitySpellings = new Map<string, string>()
  const items: ExtractedItem[] = []
  const customMetrics: Record<string, number> = {}
  const itemAttributes: Record<string, ItemAttributes> = {}
  const accumulated = new Map<FinancialMetricKey, AccumulatedMetric>()

  for (const entry of response.items) {
    if (!entry || typeof entry !== 'object') continue

    const item = entry as Record<string, unknown>
    const label = typeof item.label === 'string' ? item.label.trim() : ''

    if (!label) continue

    const resolved = resolveItemValue({
      value: toNumber(item.value),
      attributes: toItemAttributes(item.attributes),
    })

    if (resolved.value === null) continue

    const statedMetricKey =
      typeof item.metric === 'string' && isFinancialMetricKey(item.metric)
        ? item.metric
        : null

    // Statements print costs in parentheses, but an expense or a payable is
    // stored as a positive amount everywhere else in the app.
    const value =
      statedMetricKey === 'monthly_expenses' || statedMetricKey === 'accounts_payable'
        ? Math.abs(resolved.value)
        : resolved.value

    const rawEntity = toEntity(item.entity)
    const key = entityKey(rawEntity)

    if (rawEntity && !entitySpellings.has(key)) {
      entitySpellings.set(key, rawEntity)
    }

    const entity = rawEntity ? (entitySpellings.get(key) ?? rawEntity) : ''
    const period = typeof item.period === 'string' ? item.period : null

    // A figure only feeds a fixed metric when it belongs to the primary entity
    // and, for revenue/expenses, covers a single month. A yearly figure would
    // otherwise land in a monthly metric and distort trends, so it stays an
    // item (label, value, period attribute) and is never averaged or converted.
    const isOtherEntity =
      entity !== '' && primaryEntity !== '' && !sameEntity(entity, primaryEntity)
    const isNotMonthly =
      statedMetricKey !== null &&
      MONTHLY_ONLY_METRIC_KEYS.has(statedMetricKey) &&
      period !== null &&
      period !== 'monthly'
    const metricKey = isOtherEntity || isNotMonthly ? null : statedMetricKey

    const attributes = entity ? { ...resolved.attributes, entity } : resolved.attributes

    items.push({ label, value, attributes })

    // The simple maps keep the first occurrence of a label and never
    // overwrite it; the full list above holds every occurrence.
    if (!(label in customMetrics)) {
      customMetrics[label] = value

      if (Object.keys(attributes).length > 0) {
        itemAttributes[label] = attributes
      }
    }

    if (!metricKey) {
      continue
    }

    const excerpt = `${label}: ${value}`
    const existing = accumulated.get(metricKey)

    if (!existing) {
      accumulated.set(metricKey, { value, excerpts: [excerpt] })
    } else if (ADDITIVE_METRIC_KEYS.has(metricKey)) {
      existing.value += value
      existing.excerpts.push(excerpt)
    }
  }

  const metrics: AvailableFinancialMetricValue[] = asOfDate
    ? [...accumulated.entries()].map(([key, entry]) => ({
        status: 'available' as const,
        key,
        value: entry.value,
        currency,
        periodStart: null,
        periodEnd: null,
        asOfDate,
        provenance: {
          sourceType: 'document' as const,
          sourceLabel: context.sourceLabel,
          sourceId: context.documentId,
          evidence: {
            documentId: context.documentId,
            excerpt: entry.excerpts.join(' | '),
          },
        },
        confidence: MODEL_CONFIDENCE,
        updatedAt: context.extractedAt,
      }))
    : []

  return { metrics, items, customMetrics, itemAttributes }
}

/**
 * Cuts the document into pieces the model can read closely: one per page, with
 * very long pages split at line breaks, blank pages dropped, and a cap on the
 * total so a huge document cannot run up an unbounded number of calls. Pure.
 */
export function splitIntoSegments(pages: string[]): string[] {
  const segments: string[] = []

  for (const page of pages) {
    const text = page.trim()

    if (text.length < MIN_SEGMENT_CHARS) continue

    if (text.length <= MAX_SEGMENT_CHARS) {
      segments.push(text)
      continue
    }

    let current = ''

    for (const line of text.split('\n')) {
      if (current && current.length + line.length + 1 > MAX_SEGMENT_CHARS) {
        segments.push(current)
        current = ''
      }

      current += (current ? '\n' : '') + line
    }

    if (current.trim()) segments.push(current)
  }

  return segments.slice(0, MAX_SEGMENTS)
}

function createModel(apiKey: string) {
  return new ChatOpenAI({
    model: TEXT_EXTRACTION_MODEL,
    temperature: 0,
    apiKey,
    timeout: 60_000,
    maxRetries: 1,
  })
}

async function askModel(model: ChatOpenAI, system: string, human: string) {
  const response = await model.invoke([new SystemMessage(system), new HumanMessage(human)])

  return typeof response.content === 'string' ? response.content : ''
}

// A cheap first look at the opening pages to learn who the document is about
// and what currency it uses; the answer is handed to every page's call.
async function identifyDocument(model: ChatOpenAI, openingText: string) {
  try {
    const raw = await askModel(model, IDENTIFY_PROMPT, `Document opening:\n\n${openingText}`)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const json = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : null

    return {
      primaryEntity: json ? toEntity(json.primaryEntity) : '',
      currency: json ? toCurrency(json.currency) : null,
    }
  } catch {
    // The hint is optional; without it each page falls back to its own guess.
    return { primaryEntity: '', currency: null as string | null }
  }
}

/**
 * Sends a document's already-extracted pages to the model, one small call per
 * page, and returns the combined structured result. Throws when every call
 * fails and returns null on unusable replies, so callers can fall back to the
 * deterministic regex extraction.
 */
export async function extractTextFinancialMetrics(
  pages: string[],
  context: TextExtractionContext
): Promise<TextExtractionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  const segments = splitIntoSegments(pages)

  if (segments.length === 0) {
    return null
  }

  const model = createModel(apiKey)
  const identity = await identifyDocument(
    model,
    segments.join('\n\n').slice(0, IDENTIFY_INPUT_CHARS)
  )
  const hint = [
    identity.primaryEntity && `This document is mainly about: ${identity.primaryEntity}.`,
    identity.currency && `Its currency is ${identity.currency}.`,
  ]
    .filter(Boolean)
    .join(' ')

  const replies: string[] = []
  const narrativeReplies: string[] = []
  let lastError: unknown = null

  for (let start = 0; start < segments.length; start += SEGMENT_CONCURRENCY) {
    const batch = segments.slice(start, start + SEGMENT_CONCURRENCY)
    const messageFor = (segment: string, offset: number) =>
      `${hint ? `${hint}\n\n` : ''}Document text (part ${start + offset + 1} of ${segments.length}):\n\n${segment}`
    const [settled, narrativeSettled] = await Promise.all([
      Promise.allSettled(
        batch.map((segment, offset) =>
          askModel(model, TEXT_EXTRACTION_PROMPT, messageFor(segment, offset))
        )
      ),
      Promise.allSettled(
        batch.map((segment, offset) =>
          askModel(model, NARRATIVE_PROMPT, messageFor(segment, offset))
        )
      ),
    ])

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        replies.push(result.value)
      } else {
        lastError = result.reason
      }
    }

    // A failed narrative call only loses that page's prose facts, so it is
    // not counted as a failure of the extraction.
    for (const result of narrativeSettled) {
      if (result.status === 'fulfilled') {
        narrativeReplies.push(result.value)
      }
    }
  }

  if (replies.length === 0 && lastError) {
    throw lastError
  }

  if (lastError) {
    console.warn(
      `Some parts of ${context.sourceLabel} could not be read by the model; keeping the rest.`,
      lastError
    )
  }

  const combined = combineSegmentReplies(replies, identity.primaryEntity || null, narrativeReplies)

  return combined ? buildExtractionResult(combined, context) : null
}
