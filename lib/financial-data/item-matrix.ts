import {
  TOTAL_ATTRIBUTE_KEY,
  computeItemTotal,
  toAttributeValue,
  toItemAttributes,
  type ExtractedItem,
  type ItemAttributes,
} from '@/lib/financial-data/attributes'

export interface ItemMatrixRow {
  index: number
  label: string
  value: number
  attributes: ItemAttributes
}

export interface ItemMatrix {
  rows: ItemMatrixRow[]
  columns: string[]
}

export type AttributeChanges = Record<string, string | number | null>

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function readExtractedItemsWithIndex(metadata: unknown): ItemMatrixRow[] {
  const stored = asRecord(metadata).extractedItems
  if (!Array.isArray(stored)) return []

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

    rows.push({
      index,
      label: item.label.trim(),
      value: item.value,
      attributes: toItemAttributes(item.attributes),
    })
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

  return {
    rows,
    columns: [...counts.keys()].sort(
      (left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0)
    ),
  }
}

export function applyItemValueEdit(
  metadata: unknown,
  index: number,
  value: number
): Record<string, unknown> | null {
  const current = asRecord(metadata)
  if (!Array.isArray(current.extractedItems)) return null

  const items = [...current.extractedItems]
  const target = items[index]
  if (!target || typeof target !== 'object') return null

  const item = target as { value?: unknown; attributes?: unknown }
  const attributes = toItemAttributes(item.attributes)
  if (attributes[TOTAL_ATTRIBUTE_KEY] === item.value) {
    attributes[TOTAL_ATTRIBUTE_KEY] = value
  }

  items[index] = { ...item, value, attributes }
  return { ...current, extractedItems: items }
}

export function applyItemAttributeEdit(
  metadata: unknown,
  index: number,
  changes: AttributeChanges
): Record<string, unknown> | null {
  const current = asRecord(metadata)
  if (!Array.isArray(current.extractedItems)) return null

  const items = [...current.extractedItems]
  const target = items[index]
  if (!target || typeof target !== 'object') return null

  const item = target as { value?: unknown; attributes?: unknown }
  const previous = toItemAttributes(item.attributes)
  const attributes: ItemAttributes = { ...previous }
  for (const [rawKey, change] of Object.entries(changes)) {
    const key = rawKey.trim()
    if (!key) continue
    if (change === null || (typeof change === 'string' && !change.trim())) {
      delete attributes[key]
    } else {
      attributes[key] =
        typeof change === 'string' ? toAttributeValue(change) : change
    }
  }

  let value = item.value
  if (previous[TOTAL_ATTRIBUTE_KEY] === item.value) {
    delete attributes[TOTAL_ATTRIBUTE_KEY]
    const total = computeItemTotal(attributes)
    if (total !== null) {
      value = total
      attributes[TOTAL_ATTRIBUTE_KEY] = total
    } else {
      attributes[TOTAL_ATTRIBUTE_KEY] = previous[TOTAL_ATTRIBUTE_KEY]
    }
  }

  items[index] = { ...item, value, attributes }
  return { ...current, extractedItems: items }
}

export function applyItemAppend(
  metadata: unknown,
  item: ExtractedItem
): Record<string, unknown> {
  const current = asRecord(metadata)
  const items = Array.isArray(current.extractedItems)
    ? [...current.extractedItems]
    : []
  items.push(item)
  return { ...current, extractedItems: items }
}
