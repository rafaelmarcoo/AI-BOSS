import {
  computeItemTotal,
  resolveItemValue,
} from '@/lib/financial-data/attributes'

describe('computeItemTotal', () => {
  it('multiplies price by quantity (the icecream example)', () => {
    expect(computeItemTotal({ price: 15, quantity: 34, department: 'A' })).toBe(510)
  })

  it('reads numbers written as text, with currency symbols and separators', () => {
    expect(computeItemTotal({ Price: '$15.00', Quantity: '1,000' })).toBe(15000)
  })

  it('recognizes common name variants regardless of case and punctuation', () => {
    expect(computeItemTotal({ 'Unit Price': 2.5, QTY: 4 })).toBe(10)
    expect(computeItemTotal({ unit_cost: 3, Units: 5 })).toBe(15)
  })

  it('does not treat "amount" as a quantity', () => {
    expect(computeItemTotal({ price: 15, amount: 34 })).toBeNull()
  })

  it('returns null when only one of price or quantity is present', () => {
    expect(computeItemTotal({ price: 15 })).toBeNull()
    expect(computeItemTotal({ quantity: 34 })).toBeNull()
    expect(computeItemTotal({ department: 'A' })).toBeNull()
    expect(computeItemTotal(null)).toBeNull()
  })

  it('returns null when a value is not numeric', () => {
    expect(computeItemTotal({ price: 'abc', quantity: 34 })).toBeNull()
  })

  it('rounds away floating point noise to cents', () => {
    expect(computeItemTotal({ price: 0.1, quantity: 3 })).toBe(0.3)
    expect(computeItemTotal({ price: 32.4, quantity: 5 })).toBe(162)
  })
})

describe('resolveItemValue', () => {
  it('computes the value from price and quantity when the row has none, and keeps all three', () => {
    const resolved = resolveItemValue({
      value: null,
      attributes: { price: 15, quantity: 34, department: 'A' },
    })

    expect(resolved).toEqual({
      value: 510,
      computed: true,
      attributes: { price: 15, quantity: 34, department: 'A', total: 510 },
    })
  })

  it('never overrides a value that came from the source', () => {
    const resolved = resolveItemValue({
      value: 400,
      attributes: { price: 15, quantity: 34 },
    })

    expect(resolved.value).toBe(400)
    expect(resolved.computed).toBe(false)
    expect(resolved.attributes).toEqual({ price: 15, quantity: 34 })
  })

  it('keeps an explicit zero value', () => {
    expect(resolveItemValue({ value: 0, attributes: { price: 15, quantity: 34 } }).value).toBe(0)
  })

  it('leaves the value empty when there is nothing to compute from', () => {
    const resolved = resolveItemValue({ value: null, attributes: { department: 'A' } })

    expect(resolved).toEqual({
      value: null,
      computed: false,
      attributes: { department: 'A' },
    })
  })
})
