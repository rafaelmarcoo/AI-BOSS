import {
  applyItemAppend,
  applyItemAttributeEdit,
  applyItemValueEdit,
  buildItemMatrix,
  readExtractedItemsWithIndex,
} from '@/lib/financial-data/item-matrix'

describe('readExtractedItemsWithIndex', () => {
  it('reads items from metadata and keeps their stored position', () => {
    const rows = readExtractedItemsWithIndex({
      extractedItems: [
        { label: 'Revenue', value: 203.3, attributes: { entity: 'Ressett' } },
        { label: 'Revenue', value: 187, attributes: { entity: 'Fixxupp' } },
      ],
    })

    expect(rows).toEqual([
      { index: 0, label: 'Revenue', value: 203.3, attributes: { entity: 'Ressett' } },
      { index: 1, label: 'Revenue', value: 187, attributes: { entity: 'Fixxupp' } },
    ])
  })

  it('skips unusable entries without shifting the position of the others', () => {
    const rows = readExtractedItemsWithIndex({
      extractedItems: [
        'junk',
        { label: '', value: 5 },
        { label: 'Bad', value: 'x' },
        { label: 'Bank', value: 7.8, attributes: { unit: 'L$ million', nested: { a: 1 } } },
      ],
    })

    // Index 3 is the real position in the stored list, which is what an edit needs.
    expect(rows).toEqual([{ index: 3, label: 'Bank', value: 7.8, attributes: { unit: 'L$ million' } }])
  })

  it('returns an empty list when there are no items', () => {
    expect(readExtractedItemsWithIndex(null)).toEqual([])
    expect(readExtractedItemsWithIndex({})).toEqual([])
    expect(readExtractedItemsWithIndex({ extractedItems: 'nope' })).toEqual([])
  })
})

describe('buildItemMatrix', () => {
  it('orders attribute columns by how many rows use them', () => {
    const matrix = buildItemMatrix([
      { index: 0, label: 'A', value: 1, attributes: { unit: 'kg' } },
      { index: 1, label: 'B', value: 2, attributes: { entity: 'X', unit: 'kg' } },
      { index: 2, label: 'C', value: 3, attributes: { entity: 'X', unit: 'kg', column: 'Total' } },
    ])

    expect(matrix.columns).toEqual(['unit', 'entity', 'column'])
  })

  it('has no columns when no row has attributes', () => {
    expect(buildItemMatrix([{ index: 0, label: 'A', value: 1, attributes: {} }]).columns).toEqual([])
  })
})

describe('applyItemValueEdit', () => {
  const metadata = {
    currency: 'NZD',
    extractedMetrics: { Revenue: 203.3 },
    extractedItems: [
      { label: 'Revenue', value: 203.3, attributes: { entity: 'Ressett' } },
      { label: 'Revenue', value: 187, attributes: { entity: 'Fixxupp' } },
    ],
  }

  it('changes only the chosen item when labels repeat, leaving the other company alone', () => {
    const updated = applyItemValueEdit(metadata, 1, 190)

    expect((updated?.extractedItems as { value: number }[]).map((item) => item.value)).toEqual([203.3, 190])
    // The simple map holds the first Revenue, so editing the second must not touch it.
    expect(updated?.extractedMetrics).toEqual({ Revenue: 203.3 })
    expect(updated?.currency).toBe('NZD')
  })

  it('updates the simple label map when the first item with that label is edited', () => {
    const updated = applyItemValueEdit(metadata, 0, 210)

    expect(updated?.extractedMetrics).toEqual({ Revenue: 210 })
  })

  it('moves a computed total with the value', () => {
    const updated = applyItemValueEdit(
      { extractedItems: [{ label: 'Icecream', value: 510, attributes: { price: 15, quantity: 34, total: 510 } }] },
      0,
      600
    )

    expect((updated?.extractedItems as { attributes: Record<string, number> }[])[0].attributes.total).toBe(600)
  })

  it('leaves the original metadata untouched and returns null for a missing item', () => {
    applyItemValueEdit(metadata, 0, 1)

    expect(metadata.extractedItems[0].value).toBe(203.3)
    expect(applyItemValueEdit(metadata, 9, 1)).toBeNull()
    expect(applyItemValueEdit({}, 0, 1)).toBeNull()
  })
})

describe('applyItemAttributeEdit', () => {
  const metadata = {
    extractedMetrics: { Icecream: 500 },
    extractedMetricAttributes: { Icecream: { department: 'A' } },
    extractedItems: [
      { label: 'Icecream', value: 500, attributes: { department: 'A' } },
      { label: 'Icecream', value: 300, attributes: { department: 'B' } },
    ],
  }
  const attributesOf = (updated: Record<string, unknown> | null, index: number) =>
    (updated?.extractedItems as { attributes: Record<string, unknown> }[])[index].attributes

  it('sets an attribute on the chosen item only', () => {
    const updated = applyItemAttributeEdit(metadata, 1, { warehouse: '2' })

    expect(attributesOf(updated, 1)).toEqual({ department: 'B', warehouse: 2 })
    expect(attributesOf(updated, 0)).toEqual({ department: 'A' })
    // The first-occurrence map belongs to item 0, so editing item 1 leaves it alone.
    expect(updated?.extractedMetricAttributes).toEqual({ Icecream: { department: 'A' } })
  })

  it('updates the first-occurrence attribute map when the first item changes', () => {
    const updated = applyItemAttributeEdit(metadata, 0, { department: 'C' })

    expect(updated?.extractedMetricAttributes).toEqual({ Icecream: { department: 'C' } })
  })

  it('removes an attribute when the new value is blank or null', () => {
    expect(attributesOf(applyItemAttributeEdit(metadata, 0, { department: '  ' }), 0)).toEqual({})
    expect(attributesOf(applyItemAttributeEdit(metadata, 0, { department: null }), 0)).toEqual({})
  })

  it('recomputes a computed total when price or quantity changes', () => {
    const computed = {
      extractedMetrics: { Icecream: 510 },
      extractedItems: [
        { label: 'Icecream', value: 510, attributes: { price: 15, quantity: 34, total: 510 } },
      ],
    }
    const updated = applyItemAttributeEdit(computed, 0, { quantity: '40' })
    const item = (updated?.extractedItems as { value: number; attributes: Record<string, number> }[])[0]

    expect(item.value).toBe(600)
    expect(item.attributes).toEqual({ price: 15, quantity: 40, total: 600 })
    expect(updated?.extractedMetrics).toEqual({ Icecream: 600 })
  })

  it('leaves a value that came from the source alone even when price and quantity change', () => {
    const stated = {
      extractedItems: [{ label: 'Cake', value: 600, attributes: { price: 15, quantity: 34 } }],
    }
    const updated = applyItemAttributeEdit(stated, 0, { quantity: 50 })

    expect((updated?.extractedItems as { value: number }[])[0].value).toBe(600)
  })

  it('keeps the value and total when the price is removed from a computed row', () => {
    const computed = {
      extractedItems: [
        { label: 'Icecream', value: 510, attributes: { price: 15, quantity: 34, total: 510 } },
      ],
    }
    const updated = applyItemAttributeEdit(computed, 0, { price: null })
    const item = (updated?.extractedItems as { value: number; attributes: Record<string, number> }[])[0]

    expect(item.value).toBe(510)
    expect(item.attributes.total).toBe(510)
  })

  it('returns null for a missing item and does not change the original', () => {
    expect(applyItemAttributeEdit(metadata, 9, { a: 'b' })).toBeNull()
    expect(applyItemAttributeEdit({}, 0, { a: 'b' })).toBeNull()

    applyItemAttributeEdit(metadata, 0, { department: 'Z' })
    expect(metadata.extractedItems[0].attributes).toEqual({ department: 'A' })
  })
})

describe('applyItemAppend', () => {
  it('adds a new item and its label to the simple map', () => {
    const updated = applyItemAppend({ currency: 'NZD' }, { label: 'Rent', value: 900 })

    expect(updated.extractedItems).toEqual([{ label: 'Rent', value: 900, attributes: {} }])
    expect(updated.extractedMetrics).toEqual({ Rent: 900 })
    expect(updated.currency).toBe('NZD')
  })

  it('allows a repeated label and leaves the first occurrence in the simple map', () => {
    const start = {
      extractedMetrics: { Icecream: 500 },
      extractedItems: [{ label: 'Icecream', value: 500, attributes: { department: 'A' } }],
    }
    const updated = applyItemAppend(start, {
      label: 'Icecream',
      value: 300,
      attributes: { department: 'B' },
    })

    expect(updated.extractedItems).toHaveLength(2)
    expect(updated.extractedMetrics).toEqual({ Icecream: 500 })
  })
})
