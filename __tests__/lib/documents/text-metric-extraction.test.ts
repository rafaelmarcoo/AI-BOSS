import {
  combineSegmentReplies,
  parseTextExtractionResponse,
  splitIntoSegments,
} from '@/lib/documents/text-metric-extraction'

const context = {
  documentId: 'doc-1',
  sourceLabel: 'report.pdf',
  extractedAt: '2026-06-01T00:00:00.000Z',
}

function parse(reply: unknown) {
  return parseTextExtractionResponse(
    typeof reply === 'string' ? reply : JSON.stringify(reply),
    context
  )
}

describe('parseTextExtractionResponse', () => {
  it('sums several items mapped to the same additive metric and keeps each item', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      currency: 'nzd',
      items: [
        { label: 'Icecream Revenue', value: 500, metric: 'monthly_revenue' },
        { label: 'Pumpkin Revenue', value: 300, metric: 'monthly_revenue' },
      ],
    })

    expect(result?.metrics).toHaveLength(1)
    expect(result?.metrics[0]).toMatchObject({
      key: 'monthly_revenue',
      value: 800,
      currency: 'NZD',
      asOfDate: '2026-03-31',
      confidence: 0.7,
    })
    expect(result?.customMetrics).toEqual({
      'Icecream Revenue': 500,
      'Pumpkin Revenue': 300,
    })
  })

  it('computes price x quantity when the row has no value, and keeps all attributes', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      items: [
        {
          label: 'Icecream Revenue',
          value: null,
          metric: 'monthly_revenue',
          attributes: { price: 15, quantity: 34, department: 'A' },
        },
      ],
    })

    expect(result?.metrics[0]).toMatchObject({ key: 'monthly_revenue', value: 510 })
    expect(result?.customMetrics).toEqual({ 'Icecream Revenue': 510 })
    expect(result?.itemAttributes).toEqual({
      'Icecream Revenue': { price: 15, quantity: 34, department: 'A', total: 510 },
    })
  })

  it('keeps items and attributes but records no fixed metrics without a reporting date', () => {
    const result = parse({
      asOfDate: null,
      items: [{ label: 'Revenue', value: 203.3, metric: 'monthly_revenue' }],
    })

    expect(result?.metrics).toEqual([])
    expect(result?.customMetrics).toEqual({ Revenue: 203.3 })
  })

  it('rejects a malformed date rather than trusting it', () => {
    const result = parse({
      asOfDate: '31 March',
      items: [{ label: 'Revenue', value: 10, metric: 'monthly_revenue' }],
    })

    expect(result?.metrics).toEqual([])
  })

  it('keeps only the first value for non-additive metrics', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      items: [
        { label: 'Runway', value: 6, metric: 'runway_months' },
        { label: 'Runway (best case)', value: 9, metric: 'runway_months' },
      ],
    })

    expect(result?.metrics).toHaveLength(1)
    expect(result?.metrics[0]).toMatchObject({ key: 'runway_months', value: 6 })
  })

  it('treats an unknown metric name as a plain custom item', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      items: [{ label: 'Gross profit', value: 56.9, metric: 'gross_profit' }],
    })

    expect(result?.metrics).toEqual([])
    expect(result?.customMetrics).toEqual({ 'Gross profit': 56.9 })
  })

  it('reads numbers given as text and skips items with no usable value or label', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      items: [
        { label: 'Bank', value: '7,800', metric: 'cash' },
        { label: 'Broken', value: 'n/a' },
        { label: '', value: 5 },
        'not an object',
      ],
    })

    expect(result?.customMetrics).toEqual({ Bank: 7800 })
    expect(result?.metrics[0]).toMatchObject({ key: 'cash', value: 7800 })
  })

  it('tolerates the JSON being wrapped in extra text', () => {
    const result = parse('Sure! ```json\n{"items": [{"label": "Rent", "value": 900}]}\n```')

    expect(result?.customMetrics).toEqual({ Rent: 900 })
  })

  it('keeps repeated labels as separate items when their attributes differ', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      items: [
        {
          label: 'Icecream',
          value: 500,
          metric: 'monthly_revenue',
          attributes: { department: 'A' },
        },
        {
          label: 'Icecream',
          value: 300,
          metric: 'monthly_revenue',
          attributes: { department: 'B' },
        },
      ],
    })

    expect(result?.items).toEqual([
      { label: 'Icecream', value: 500, attributes: { department: 'A' } },
      { label: 'Icecream', value: 300, attributes: { department: 'B' } },
    ])
    // Both feed the combined metric...
    expect(result?.metrics[0]).toMatchObject({ key: 'monthly_revenue', value: 800 })
    // ...while the simple maps keep the first occurrence and never overwrite.
    expect(result?.customMetrics).toEqual({ Icecream: 500 })
    expect(result?.itemAttributes).toEqual({ Icecream: { department: 'A' } })
  })

  it('does not let a repeated label overwrite the first one (Tax in two statements)', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      items: [
        { label: 'Tax', value: 3.9, attributes: { statement: 'Profit or loss' } },
        { label: 'Tax', value: 3.7, attributes: { statement: 'Financial position' } },
      ],
    })

    expect(result?.items).toHaveLength(2)
    expect(result?.customMetrics).toEqual({ Tax: 3.9 })
  })

  it('stores expenses and payables as positive amounts even when printed in parentheses', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      items: [
        { label: 'Administrative expenses', value: -28.5, metric: 'monthly_expenses' },
        { label: 'Trade payables', value: -12.2, metric: 'accounts_payable' },
        { label: 'Operating loss', value: -4, metric: null },
      ],
    })

    expect(result?.metrics.find((m) => m.key === 'monthly_expenses')?.value).toBe(28.5)
    expect(result?.metrics.find((m) => m.key === 'accounts_payable')?.value).toBe(12.2)
    // A parenthesised loss stays negative.
    expect(result?.customMetrics['Operating loss']).toBe(-4)
  })

  it('keeps an annual revenue or expense out of the monthly metrics but stores it as an item', () => {
    const result = parse({
      asOfDate: '2025-03-31',
      items: [
        {
          label: 'Revenue',
          value: 203.3,
          metric: 'monthly_revenue',
          period: 'annual',
          attributes: { period: 'year ended 31 March 2025' },
        },
        { label: 'Administrative expenses', value: -28.5, metric: 'monthly_expenses', period: 'annual' },
      ],
    })

    expect(result?.metrics).toEqual([])
    expect(result?.items).toEqual([
      { label: 'Revenue', value: 203.3, attributes: { period: 'year ended 31 March 2025' } },
      { label: 'Administrative expenses', value: 28.5, attributes: {} },
    ])
  })

  it('still fills monthly metrics for monthly or unstated periods', () => {
    const result = parse({
      asOfDate: '2026-03-31',
      items: [
        { label: 'Sales', value: 900, metric: 'monthly_revenue', period: 'monthly' },
        { label: 'Rent', value: 100, metric: 'monthly_expenses', period: null },
      ],
    })

    expect(result?.metrics.map((m) => [m.key, m.value])).toEqual([
      ['monthly_revenue', 900],
      ['monthly_expenses', 100],
    ])
  })

  it('does not treat a balance-sheet item as annual', () => {
    const result = parse({
      asOfDate: '2025-03-31',
      items: [{ label: 'Bank', value: 7.8, metric: 'cash', period: 'point_in_time' }],
    })

    expect(result?.metrics[0]).toMatchObject({ key: 'cash', value: 7.8 })
  })

  it('stores another company\'s figures as items tagged with entity, never as fixed metrics', () => {
    const result = parse({
      primaryEntity: 'Ressett',
      asOfDate: '2025-03-31',
      items: [
        { label: 'Bank', value: 7.8, metric: 'cash', entity: 'Ressett', period: 'point_in_time' },
        { label: 'Bank', value: 6.3, metric: 'cash', entity: 'Fixxupp', period: 'point_in_time' },
      ],
    })

    expect(result?.metrics).toHaveLength(1)
    expect(result?.metrics[0]).toMatchObject({ key: 'cash', value: 7.8 })
    expect(result?.items).toEqual([
      { label: 'Bank', value: 7.8, attributes: { entity: 'Ressett' } },
      { label: 'Bank', value: 6.3, attributes: { entity: 'Fixxupp' } },
    ])
  })

  it('matches the primary entity ignoring case and treats a missing entity as primary', () => {
    const result = parse({
      primaryEntity: 'Ressett',
      asOfDate: '2025-03-31',
      items: [
        { label: 'Bank', value: 7.8, metric: 'cash', entity: 'RESSETT' },
        { label: 'Trade and other receivables', value: 16.1, metric: 'accounts_receivable' },
      ],
    })

    expect(result?.metrics.map((m) => m.key).sort()).toEqual(['accounts_receivable', 'cash'])
  })

  it('returns null for unusable replies so the caller can fall back to regex', () => {
    expect(parse('I could not find anything.')).toBeNull()
    expect(parse('{ not json }')).toBeNull()
    expect(parse({ primaryEntity: 'Acme' })).toBeNull()
    expect(parse([1, 2, 3])).toBeNull()
  })
})

describe('splitIntoSegments', () => {
  it('gives each page its own segment and drops blank pages', () => {
    expect(splitIntoSegments(['Page one text here', '   ', 'Page two text here'])).toEqual([
      'Page one text here',
      'Page two text here',
    ])
  })

  it('splits a very long page at line breaks without cutting a line', () => {
    const line = 'x'.repeat(1000)
    const page = Array.from({ length: 14 }, () => line).join('\n')
    const segments = splitIntoSegments([page])

    expect(segments.length).toBeGreaterThan(1)
    expect(segments.every((segment) => segment.length <= 6000)).toBe(true)
    expect(segments.join('\n')).toBe(page)
  })

  it('caps the number of segments', () => {
    const pages = Array.from({ length: 100 }, (_, i) => `Page number ${i} with text`)

    expect(splitIntoSegments(pages)).toHaveLength(60)
  })
})

describe('combineSegmentReplies', () => {
  it('merges the items of every page and uses the most common date and currency', () => {
    const combined = combineSegmentReplies([
      JSON.stringify({ asOfDate: '2025-03-31', currency: 'NZD', items: [{ label: 'A', value: 1 }] }),
      JSON.stringify({ asOfDate: '2025-03-31', items: [{ label: 'B', value: 2 }] }),
      JSON.stringify({ asOfDate: '2024-03-31', items: [{ label: 'C', value: 3 }] }),
    ])

    expect(combined?.items).toHaveLength(3)
    expect(combined?.asOfDate).toBe('2025-03-31')
    expect(combined?.currency).toBe('NZD')
  })

  it('lets the opening-pages hint override a page that guessed the wrong primary entity', () => {
    const combined = combineSegmentReplies(
      [JSON.stringify({ primaryEntity: 'Fixxupp', items: [] })],
      'Ressett'
    )

    expect(combined?.primaryEntity).toBe('Ressett')
  })

  it('skips unusable replies and returns null when none are usable', () => {
    expect(
      combineSegmentReplies(['nonsense', JSON.stringify({ items: [{ label: 'A', value: 1 }] })])?.items
    ).toHaveLength(1)
    expect(combineSegmentReplies(['nonsense', '{ not json }'])).toBeNull()
  })
})

describe('company name matching', () => {
  it('treats "Ressett Group" and "Ressett" as the same company and stores one spelling', () => {
    const result = parse({
      primaryEntity: 'Ressett',
      asOfDate: '2025-03-31',
      items: [
        { label: 'Bank', value: 7.8, metric: 'cash', entity: 'Ressett Group' },
        { label: 'Bank', value: 6.3, metric: 'cash', entity: 'Fixxupp' },
        { label: 'Loans', value: 10, entity: 'Fixxupp Group' },
      ],
    })

    expect(result?.metrics).toHaveLength(1)
    expect(result?.metrics[0]).toMatchObject({ key: 'cash', value: 7.8 })
    expect(result?.items.map((item) => item.attributes.entity)).toEqual([
      'Ressett Group',
      'Fixxupp',
      'Fixxupp',
    ])
  })
})

describe('combineSegmentReplies with a narrative pass', () => {
  const table = JSON.stringify({
    items: [
      { label: 'Staff employed', value: 350, entity: 'Ressett', attributes: { unit: 'staff' } },
      { label: 'Loans', value: 80, entity: 'Ressett' },
    ],
  })

  it('adds prose facts the table pass missed', () => {
    const narrative = JSON.stringify({
      items: [{ label: 'Deliveries using electric vehicles', value: 85, entity: 'Ressett', attributes: { unit: '%' } }],
    })
    const combined = combineSegmentReplies([table], null, [narrative])

    expect(combined?.items).toHaveLength(3)
  })

  it('drops a prose fact the table pass already found, even worded differently', () => {
    const narrative = JSON.stringify({
      items: [{ label: 'Number of staff', value: 350, entity: 'RESSETT Group', attributes: { unit: 'Staff' } }],
    })

    expect(combineSegmentReplies([table], null, [narrative])?.items).toHaveLength(2)
  })

  it('drops a prose item that only re-reads a table row (same value and company)', () => {
    const narrative = JSON.stringify({
      items: [{ label: 'Loans outstanding', value: 80, entity: 'Ressett', attributes: { unit: 'L$ million' } }],
    })

    expect(combineSegmentReplies([table], null, [narrative])?.items).toHaveLength(2)
  })

  it('keeps a prose fact with the same number when it is about a different company', () => {
    const narrative = JSON.stringify({
      items: [{ label: 'Deliveries using electric vehicles', value: 80, entity: 'Fixxupp', attributes: { unit: '%' } }],
    })

    expect(combineSegmentReplies([table], null, [narrative])?.items).toHaveLength(3)
  })

  it('ignores prose items with no unit or number, and unusable narrative replies', () => {
    const narrative = JSON.stringify({ items: [{ label: 'Something', value: 5 }] })

    expect(combineSegmentReplies([table], null, [narrative, 'nonsense'])?.items).toHaveLength(2)
  })
})

describe('combineSegmentReplies prose facts among themselves', () => {
  it('keeps two prose facts with the same number but different units', () => {
    const narrative = JSON.stringify({
      items: [
        { label: 'Reduction in CO2e emissions', value: 5, entity: 'Ressett', attributes: { unit: '%' } },
        { label: 'E-waste dumped versus processed', value: 5, entity: 'Ressett', attributes: { unit: 'times' } },
      ],
    })

    expect(combineSegmentReplies([JSON.stringify({ items: [] })], null, [narrative])?.items).toHaveLength(2)
  })

  it('drops the same prose fact repeated on two pages', () => {
    const fact = JSON.stringify({
      items: [{ label: 'Staff employed', value: 350, entity: 'Ressett', attributes: { unit: 'staff' } }],
    })

    expect(combineSegmentReplies([JSON.stringify({ items: [] })], null, [fact, fact])?.items).toHaveLength(1)
  })
})
