import {
  buildPromotedItemsCandidate,
  hasPromotionSignature,
  selectStoredItemsForPromotion,
} from '@/lib/documents/item-promotion'

describe('supplementary Item promotion', () => {
  it('calculates the expense total on the server and retains item evidence', () => {
    const result = buildPromotedItemsCandidate({
      documentId: 'document-1',
      metricKey: 'monthly_expenses',
      currency: 'NZD',
      reportingDate: '2026-08-31',
      items: [
        { index: 0, label: 'Food Expenses', value: 23.14, attributes: {} },
        { index: 1, label: 'Icecream Expense', value: 11.15, attributes: {} },
      ],
    })

    expect(result.value).toBe(34.29)
    expect(result.candidate).toMatchObject({
      metricKey: 'monthly_expenses',
      value: 34.29,
      currency: 'NZD',
      reportingDate: '2026-08-31',
      extractorVersion: 'user_item_promotion_v1',
      evidence: {
        documentId: 'document-1',
        itemIndexes: [0, 1],
        calculation: '23.14 + 11.15',
      },
    })
  })

  it('creates the same signature regardless of selection order', () => {
    const base = {
      documentId: 'document-1',
      metricKey: 'monthly_revenue' as const,
      currency: 'NZD' as const,
      reportingDate: '2026-08-31',
    }
    const first = buildPromotedItemsCandidate({
      ...base,
      items: [
        { index: 3, label: 'Car', value: 1700, attributes: {} },
        { index: 2, label: 'Wood', value: 100, attributes: {} },
      ],
    })
    const second = buildPromotedItemsCandidate({
      ...base,
      items: [
        { index: 2, label: 'Wood', value: 100, attributes: {} },
        { index: 3, label: 'Car', value: 1700, attributes: {} },
      ],
    })

    expect(first.value).toBe(1800)
    expect(first.promotionSignature).toBe(second.promotionSignature)
  })

  it('rereads selected Items from stored metadata and rejects stale indexes', () => {
    const metadata = {
      extractedItems: [
        { label: 'Food', value: 23.14, attributes: {} },
        { label: 'Icecream', value: 11.15, attributes: {} },
      ],
    }

    expect(selectStoredItemsForPromotion(metadata, [1, 0])).toMatchObject([
      { index: 0, label: 'Food', value: 23.14 },
      { index: 1, label: 'Icecream', value: 11.15 },
    ])
    expect(selectStoredItemsForPromotion(metadata, [0, 3])).toBeNull()
  })

  it('detects duplicate promotion signatures from stored evidence', () => {
    const promotionSignature = '[[0,1],"monthly_expenses","NZD","2026-08-31"]'
    expect(hasPromotionSignature([
      { evidence: { promotionSignature } },
      { evidence: { promotionSignature: 'different' } },
    ], promotionSignature)).toBe(true)
    expect(hasPromotionSignature([{ evidence: null }], promotionSignature)).toBe(false)
  })
})
