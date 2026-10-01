// Turns a document's stored `extractedItems` into a matrix: one row per item
// and one column per attribute name used by any row. Pure functions only, so
// the review table stays a thin renderer and this logic can be unit-tested.
import {
  TOTAL_ATTRIBUTE_KEY,
  computeItemTotal,
  toAttributeValue,
  toItemAttributes,
  type ExtractedItem,
  type ItemAttributes,
} from '@/lib/financial-data/attributes'

export interface ItemMatrixRow {
  // Position in the stored list. The row's identity: a label is not unique
  // (the same label can appear for two companies or departments).
  index: number
  label: string
  value: number
  attributes: ItemAttributes
}

export interface ItemMatrix {
  rows: ItemMatrixRow[]
  // Attribute names, most widely used first, so shared columns such as
  // "entity" or "period" sit next to the value and rare ones go last.
  columns: string[]
}

/**
 * Reads `extractedItems` out of a document's metadata JSONB, skipping any
 * entry that is not a usable item. Each row keeps its position in the stored
 * list (even when earlier entries were skipped), because that position is
 * what an edit uses to find the item again.
 */
export function readExtractedItemsWithIndex(metadata: unknown): ItemMatrixRow[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return []
  }

  const stored = (metadata as Record<string, unknown>).extractedItems

  if (!Array.isArray(stored)) {
    return []
  }

  const rows: ItemMatrixRow[] = []

  stored.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return

    const item = entry as Partial<ExtractedItem>

    if (
      typeof item.label !== 'string' ||
      !item.label.trim() ||
      typeof item.value !== 'number' ||
      !Number.isFinite(item.value)
    ) {
      return
    }

    const attributes: ItemAttributes = {}

    if (item.attributes && typeof item.attributes === 'object' && !Array.isArray(item.attributes)) {
      for (const [key, value] of Object.entries(item.attributes)) {
        if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
          attributes[key] = value
        }
      }
    }

    rows.push({ index, label: item.label, value: item.value, attributes })
  })

  return rows
}

export function buildItemMatrix(rows: ItemMatrixRow[]): ItemMatrix {
  const counts = new Map<string, number>()

  for (const row of rows) {
    for (const key of Object.keys(row.attributes)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  // Map keeps first-seen order and Array.sort is stable, so columns with the
  // same usage count stay in the order they first appeared.
  const columns = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))

  return { rows, columns }
}

/**
 * Returns new document metadata with one item's value changed, or null when
 * there is no item at that position. Two things move with the value so the
 * stored data never disagrees with itself:
 * - a computed `total` attribute that still equalled the old value, and
 * - the simple `extractedMetrics` label -> value map, which holds the FIRST
 *   item with each label, so it changes only when this is that first item.
 */
export function applyItemValueEdit(
  metadata: unknown,
  index: number,
  value: number
): Record<string, unknown> | null {
  const current =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}

  if (!Array.isArray(current.extractedItems)) {
    return null
  }

  const items = [...(current.extractedItems as unknown[])]
  const target = items[index]

  if (!target || typeof target !== 'object') {
    return null
  }

  const item = target as { label?: unknown; value?: unknown; attributes?: Record<string, unknown> }
  const label = typeof item.label === 'string' ? item.label : ''
  const attributes =
    item.attributes && item.attributes.total === item.value
      ? { ...item.attributes, total: value }
      : item.attributes

  items[index] = { ...item, value, ...(attributes ? { attributes } : {}) }

  const updated: Record<string, unknown> = { ...current, extractedItems: items }
  const firstIndexWithLabel = items.findIndex(
    (entry) => entry && typeof entry === 'object' && (entry as { label?: unknown }).label === label
  )

  if (label && firstIndexWithLabel === index) {
    const existing =
      current.extractedMetrics &&
      typeof current.extractedMetrics === 'object' &&
      !Array.isArray(current.extractedMetrics)
        ? (current.extractedMetrics as Record<string, number>)
        : {}

    updated.extractedMetrics = { ...existing, [label]: value }
  }

  return updated
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

// The label -> attributes sibling of extractedMetrics holds the FIRST item
// with each label, so it is rewritten only for that item.
function withFirstOccurrenceAttributes(
  metadata: Record<string, unknown>,
  items: unknown[],
  index: number,
  label: string,
  attributes: ItemAttributes
): Record<string, unknown> {
  const firstIndexWithLabel = items.findIndex(
    (entry) => entry && typeof entry === 'object' && (entry as { label?: unknown }).label === label
  )

  if (!label || firstIndexWithLabel !== index) {
    return metadata
  }

  const map = { ...asRecord(metadata.extractedMetricAttributes) }

  if (Object.keys(attributes).length > 0) {
    map[label] = attributes
  } else {
    delete map[label]
  }

  return { ...metadata, extractedMetricAttributes: map }
}

export type AttributeChanges = Record<string, string | number | null>

/**
 * Returns new metadata with an item's attributes changed, or null when there
 * is no item at that position. A null or blank value removes the attribute.
 * If the item's value was a computed price x quantity total and the change
 * leaves a price and quantity, the total (and the value it produced) is
 * recomputed, so the row never shows a stale total.
 */
export function applyItemAttributeEdit(
  metadata: unknown,
  index: number,
  changes: AttributeChanges
): Record<string, unknown> | null {
  const current = asRecord(metadata)

  if (!Array.isArray(current.extractedItems)) {
    return null
  }

  const items = [...(current.extractedItems as unknown[])]
  const target = items[index]

  if (!target || typeof target !== 'object') {
    return null
  }

  const item = target as { label?: unknown; value?: unknown; attributes?: unknown }
  const label = typeof item.label === 'string' ? item.label : ''
  const previous = toItemAttributes(item.attributes)
  const next: ItemAttributes = { ...previous }

  for (const [rawKey, change] of Object.entries(changes)) {
    const key = rawKey.trim()

    if (!key) continue

    if (change === null || (typeof change === 'string' && !change.trim())) {
      delete next[key]
    } else {
      next[key] = typeof change === 'string' ? toAttributeValue(change) : change
    }
  }

  let value = item.value
  const wasComputed = previous[TOTAL_ATTRIBUTE_KEY] === item.value

  if (wasComputed) {
    // Drop the old total before recomputing, so it is not used as an input.
    delete next[TOTAL_ATTRIBUTE_KEY]
    const total = computeItemTotal(next)

    if (total !== null) {
      value = total
      next[TOTAL_ATTRIBUTE_KEY] = total
    } else {
      // Price or quantity was removed: keep the value and total as they were.
      next[TOTAL_ATTRIBUTE_KEY] = previous[TOTAL_ATTRIBUTE_KEY]
    }
  }

  items[index] = { ...item, value, attributes: next }

  let updated: Record<string, unknown> = { ...current, extractedItems: items }
  updated = withFirstOccurrenceAttributes(updated, items, index, label, next)

  const firstIndexWithLabel = items.findIndex(
    (entry) => entry && typeof entry === 'object' && (entry as { label?: unknown }).label === label
  )

  if (label && firstIndexWithLabel === index && typeof value === 'number' && value !== item.value) {
    updated.extractedMetrics = { ...asRecord(current.extractedMetrics), [label]: value }
  }

  return updated
}

/**
 * Returns new metadata with a manually added item at the end of the list. It
 * also adds the label to the simple label -> value map when that label is not
 * there yet (the map keeps the first occurrence of each label).
 */
export function applyItemAppend(
  metadata: unknown,
  item: { label: string; value: number; attributes?: ItemAttributes }
): Record<string, unknown> {
  const current = asRecord(metadata)
  const items = Array.isArray(current.extractedItems) ? [...(current.extractedItems as unknown[])] : []
  const attributes = item.attributes ?? {}

  items.push({ label: item.label, value: item.value, attributes })

  let updated: Record<string, unknown> = { ...current, extractedItems: items }
  const metrics = asRecord(current.extractedMetrics)

  if (!(item.label in metrics)) {
    updated.extractedMetrics = { ...metrics, [item.label]: item.value }
    updated = withFirstOccurrenceAttributes(updated, items, items.length - 1, item.label, attributes)
  }

  return updated
}
