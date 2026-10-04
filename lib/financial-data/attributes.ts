export type ItemAttributes = Record<string, string | number>

export interface ExtractedItem {
  label: string
  value: number
  attributes: ItemAttributes
}

/**
 * Preserve identifiers with leading zeroes while converting ordinary numeric
 * cell input into numbers for sorting and deterministic calculations.
 */
export function toAttributeValue(raw: string): string | number {
  const trimmed = raw.trim()

  if (/^-?\d+(\.\d+)?$/.test(trimmed) && String(Number(trimmed)) === trimmed) {
    return Number(trimmed)
  }

  return trimmed
}

export function toItemAttributes(value: unknown): ItemAttributes {
  const attributes: ItemAttributes = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return attributes

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

function parseNumeric(value: string | number) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const trimmed = value.replace(/\b[A-Z]{3}\b/gi, '').trim()
  const negative = /^\(.*\)$/.test(trimmed)
  const parsed = Number(trimmed.replace(/[,$£€¥()\s]/g, ''))

  if (!Number.isFinite(parsed)) return null
  return negative ? -Math.abs(parsed) : parsed
}

function findNumericAttribute(attributes: ItemAttributes, names: Set<string>) {
  for (const [key, value] of Object.entries(attributes)) {
    if (!names.has(normalizeKey(key))) continue
    const parsed = parseNumeric(value)
    if (parsed !== null) return parsed
  }

  return null
}

export function computeItemTotal(attributes: ItemAttributes | null | undefined) {
  if (!attributes) return null
  const price = findNumericAttribute(attributes, PRICE_KEYS)
  const quantity = findNumericAttribute(attributes, QUANTITY_KEYS)
  if (price === null || quantity === null) return null
  return Math.round((price * quantity + Number.EPSILON) * 100) / 100
}

export function resolveItemValue(item: {
  value: number | null
  attributes?: ItemAttributes | null
}): { value: number | null; attributes: ItemAttributes; computed: boolean } {
  const attributes = { ...(item.attributes ?? {}) }
  if (item.value !== null && Number.isFinite(item.value)) {
    return { value: item.value, attributes, computed: false }
  }

  const total = computeItemTotal(attributes)
  if (total === null) return { value: null, attributes, computed: false }

  return {
    value: total,
    attributes: { ...attributes, [TOTAL_ATTRIBUTE_KEY]: total },
    computed: true,
  }
}
