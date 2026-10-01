import { parseImageMetricsJson } from '@/lib/documents/image-extraction'

const context = {
  documentId: 'document-123',
  sourceLabel: 'receipt.jpg',
  extractedAt: '2026-06-01T00:00:00.000Z',
}

function parse(reply: unknown) {
  return parseImageMetricsJson(typeof reply === 'string' ? reply : JSON.stringify(reply), context)
}

describe('parseImageMetricsJson: items and attributes', () => {
  it('reads rows with their extra cells as attributes, unaffected by metric matching', () => {
    const result = parse({
      items: [
        { label: 'Icecream', value: '500', attributes: { Department: 'A' } },
        { label: 'Pumpkin', value: '300', attributes: { Department: 'B' } },
      ],
    })

    expect(result.items).toEqual([
      { label: 'Icecream', value: 500, attributes: { Department: 'A' } },
      { label: 'Pumpkin', value: 300, attributes: { Department: 'B' } },
    ])
    expect(result.customMetrics).toEqual({ Icecream: 500, Pumpkin: 300 })
    expect(result.itemAttributes.Icecream).toEqual({ Department: 'A' })
    expect(result.metrics).toEqual([])
  })

  it('computes price x quantity when the row shows no total, and keeps a stated total as is', () => {
    const result = parse({
      items: [
        { label: 'Icecream', value: '', attributes: { Price: '$15.00', Quantity: '34' } },
        { label: 'Cake', value: '600', attributes: { Price: '15', Quantity: '34' } },
      ],
    })

    expect(result.items).toEqual([
      { label: 'Icecream', value: 510, attributes: { Price: '$15.00', Quantity: '34', total: 510 } },
      { label: 'Cake', value: 600, attributes: { Price: '15', Quantity: '34' } },
    ])
  })

  it('flags unreadable values instead of dropping or guessing them', () => {
    const result = parse({
      items: [
        { label: 'Expenses', value: 'egg' },
        { label: 'Marketing Spend', value: '4,000' },
      ],
    })

    expect(result.issues).toEqual([{ label: 'Expenses', rawValue: 'egg' }])
    expect(result.customMetrics).toEqual({ 'Marketing Spend': 4000 })
  })

  it('keeps repeated labels as separate items and the first in the simple map', () => {
    const result = parse({
      items: [
        { label: 'Icecream', value: '500', attributes: { Department: 'A' } },
        { label: 'Icecream', value: '300', attributes: { Department: 'B' } },
      ],
    })

    expect(result.items).toHaveLength(2)
    expect(result.customMetrics).toEqual({ Icecream: 500 })
    expect(result.itemAttributes).toEqual({ Icecream: { Department: 'A' } })
  })

  it('returns an empty result for unusable replies', () => {
    const empty = { metrics: [], customMetrics: {}, issues: [], items: [], itemAttributes: {} }

    expect(parse('nothing here')).toEqual(empty)
    expect(parse('{ nope }')).toEqual(empty)
    expect(parse({ items: [] })).toEqual(empty)
  })
})

describe('parseImageMetricsJson: canonical metric matching', () => {
  it('recognizes a label as a known metric and shapes it like the CSV/PDF extractors', () => {
    const result = parse({ items: [{ label: 'Cash at bank', value: '7,800' }] })

    expect(result.metrics).toEqual([
      expect.objectContaining({
        status: 'available',
        key: 'cash',
        value: 7800,
        asOfDate: null,
        confidence: 0.7,
        provenance: expect.objectContaining({
          sourceType: 'document',
          sourceLabel: 'receipt.jpg',
          sourceId: 'document-123',
        }),
      }),
    ])
    // A canonical row is still in the items list, same as everything else.
    expect(result.items).toEqual([{ label: 'Cash at bank', value: 7800, attributes: {} }])
    expect(result.customMetrics).toEqual({})
  })

  it('recognizes revenue even inside a longer label, matching the CSV/PDF behaviour', () => {
    const result = parse({
      items: [
        { label: 'Icecream Revenue', value: '500' },
        { label: 'Pumpkin Revenue', value: '300' },
      ],
    })

    expect(result.metrics).toEqual([
      expect.objectContaining({ key: 'monthly_revenue', value: 800 }),
    ])
    expect(result.customMetrics).toEqual({})
  })

  it('sums additive metrics but keeps only the first occurrence of a non-additive one', () => {
    const result = parse({
      items: [
        { label: 'Revenue', value: '500' },
        { label: 'Revenue', value: '300' },
        { label: 'Runway', value: '6' },
        { label: 'Runway months', value: '9' },
      ],
    })

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'monthly_revenue', value: 800 }),
        expect.objectContaining({ key: 'runway_months', value: 6 }),
      ])
    )
  })

  it('checks the specific "cash burn" label before the broader "cash" label', () => {
    const result = parse({ items: [{ label: 'Cash burn', value: '1,200' }] })

    expect(result.metrics).toEqual([expect.objectContaining({ key: 'burn_rate', value: 1200 })])
  })

  it('reads a currency code written next to the value', () => {
    const result = parse({ items: [{ label: 'Bank balance', value: '4000 NZD' }] })

    expect(result.metrics[0]).toMatchObject({ key: 'cash', value: 4000, currency: 'NZD' })
  })

  it('still understands the older flat label -> value reply, matching metrics inside it too', () => {
    const result = parse('{"Icecream Expenses": "500", "Revenue": 4000, "Bad": "egg"}')

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'monthly_expenses', value: 500 }),
        expect.objectContaining({ key: 'monthly_revenue', value: 4000 }),
      ])
    )
    expect(result.customMetrics).toEqual({})
    expect(result.issues).toEqual([{ label: 'Bad', rawValue: 'egg' }])
    expect(result.items).toHaveLength(2)
  })
})
