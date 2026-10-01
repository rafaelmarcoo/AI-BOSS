// Extra per-item attributes (price, quantity, department, ...) and the total
// derived from a price-like and a quantity-like attribute. Pure functions
// only: every source (spreadsheet columns, PDF/image model output, manual
// entry) funnels through here so the rule lives in exactly one place.

export type ItemAttributes = Record<string, string | number>

// One extracted line item. A row is identified by its label plus its
// attributes, so the same label can legitimately appear more than once
// (Icecream for department A and for department B).
export interface ExtractedItem {
  label: string
  value: number
  attributes: ItemAttributes
}

/**
 * Text typed into a cell or read from a spreadsheet becomes an attribute
 * value: plain numbers stay numbers ("15", "32.40"), everything else stays
 * text. Leading zeros ("001") are kept as text so an identifier is not turned
 * into a different number.
 */
export function toAttributeValue(raw: string): string | number {
  const trimmed = raw.trim()

  if (/^-?\d+(\.\d+)?$/.test(trimmed) && String(Number(trimmed)) === trimmed) {
    return Number(trimmed)
  }

  return trimmed
}

/**
 * Cleans attributes coming from a model reply or user input: keeps entries
 * with a non-empty text or finite number value and trims keys and text.
 */
export function toItemAttributes(value: unknown): ItemAttributes {
  const attributes: ItemAttributes = {}

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return attributes
  }

  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim()

    if (!key) continue

    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      attributes[key] = rawValue
    } else if (typeof rawValue === 'string' && rawValue.trim()) {
      attributes[key] = rawValue.trim()
    }
  }

  return attributes
}

// "amount" is deliberately not a quantity name: it is also the monetary
// value column the extractors already look for, so treating it as a count
// would misread ordinary Label/Amount tables.
const PRICE_KEYS = new Set([
  'price',
  'unit price',
  'price per unit',
  'unit cost',
  'cost per unit',
  'rate',
  'unit rate',
])

const QUANTITY_KEYS = new Set([
  'quantity',
  'qty',
  'units',
  'unit count',
  'count',
  'number of units',
  'number',
])

export const TOTAL_ATTRIBUTE_KEY = 'total'

function normalizeKey(key: string) {
  return key
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumeric(value: string | number): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const trimmed = value.replace(/\b[A-Z]{3}\b/gi, '').trim()
  const isParenthesisNegative = /^\(.*\)$/.test(trimmed)
  const cleaned = trimmed.replace(/[,$£€¥()\s]/g, '')

  if (!cleaned) {
    return null
  }

  const parsed = Number(cleaned)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return isParenthesisNegative ? -Math.abs(parsed) : parsed
}

function findNumericAttribute(attributes: ItemAttributes, names: Set<string>) {
  for (const [key, value] of Object.entries(attributes)) {
    if (!names.has(normalizeKey(key))) continue

    const parsed = parseNumeric(value)

    if (parsed !== null) {
      return parsed
    }
  }

  return null
}

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * price × quantity, when the attributes contain both a price-like and a
 * quantity-like entry that read as numbers. Otherwise null.
 */
export function computeItemTotal(
  attributes: ItemAttributes | null | undefined
): number | null {
  if (!attributes) {
    return null
  }

  const price = findNumericAttribute(attributes, PRICE_KEYS)
  const quantity = findNumericAttribute(attributes, QUANTITY_KEYS)

  if (price === null || quantity === null) {
    return null
  }

  return roundToCents(price * quantity)
}

export interface ResolvedItem {
  value: number | null
  attributes: ItemAttributes
  computed: boolean
}

/**
 * Fills in a row's value from price × quantity, but only when the row has no
 * value of its own — a value that came from the source always wins. When the
 * total is computed it is also stored as a `total` attribute, so price,
 * quantity and total all stay visible side by side.
 */
export function resolveItemValue(item: {
  value: number | null
  attributes?: ItemAttributes | null
}): ResolvedItem {
  const attributes: ItemAttributes = { ...(item.attributes ?? {}) }

  if (item.value !== null) {
    return { value: item.value, attributes, computed: false }
  }

  const total = computeItemTotal(attributes)

  if (total === null) {
    return { value: null, attributes, computed: false }
  }

  return {
    value: total,
    attributes: { ...attributes, [TOTAL_ATTRIBUTE_KEY]: total },
    computed: true,
  }
}
