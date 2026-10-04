import {
  applyItemAppend,
  applyItemAttributeEdit,
  applyItemValueEdit,
  buildItemMatrix,
  readExtractedItemsWithIndex,
} from '@/lib/financial-data/item-matrix'

describe('supplementary document item matrix', () => {
  const metadata = {
    source: 'ai_assisted',
    extractedItems: [
      {
        label: 'Hosting',
        value: 300,
        attributes: { price: 100, quantity: 3, total: 300, department: 'IT' },
      },
      {
        label: 'Software',
        value: 80,
        attributes: { department: 'Operations' },
      },
    ],
  }

  it('builds stable rows and orders shared columns first', () => {
    const matrix = buildItemMatrix(readExtractedItemsWithIndex(metadata))

    expect(matrix.rows).toHaveLength(2)
    expect(matrix.rows[0]).toMatchObject({ index: 0, label: 'Hosting', value: 300 })
    expect(matrix.columns[0]).toBe('department')
  })

  it('recomputes a price by quantity total after an attribute edit', () => {
    const updated = applyItemAttributeEdit(metadata, 0, { quantity: '4' })

    expect(updated).not.toBeNull()
    expect(readExtractedItemsWithIndex(updated)[0]).toMatchObject({
      value: 400,
      attributes: { price: 100, quantity: 4, total: 400 },
    })
  })

  it('changes document metadata without creating a trusted observation shape', () => {
    const valueEdited = applyItemValueEdit(metadata, 1, 95)
    const appended = applyItemAppend(valueEdited, {
      label: 'Insurance',
      value: 120,
      attributes: { period: 'monthly' },
    })

    expect(readExtractedItemsWithIndex(appended)).toHaveLength(3)
    expect(readExtractedItemsWithIndex(appended)[1].value).toBe(95)
    expect(appended).not.toHaveProperty('financial_metric_observations')
    expect(appended.source).toBe('ai_assisted')
  })
})
