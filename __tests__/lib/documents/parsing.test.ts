import { mammothHtmlToLines } from '@/lib/documents/parsing'

describe('mammothHtmlToLines', () => {
  it('reconstructs each table row as one "label: value" line', () => {
    const html =
      '<p>As at 12-06-2026</p><table><tr><td><p>Metric</p></td><td><p>Amount</p></td></tr>' +
      '<tr><td><p>Revenue</p></td><td><p>10000</p></td></tr>' +
      '<tr><td><p>Expenses</p></td><td><p>Apple</p></td></tr></table>'

    expect(mammothHtmlToLines(html)).toEqual([
      'As at 12-06-2026',
      'Metric: Amount',
      'Revenue: 10000',
      'Expenses: Apple',
    ])
  })

  it('keeps paragraphs before and after a table in order', () => {
    const html =
      '<p>Intro paragraph</p><table><tr><td><p>Cash</p></td><td><p>5000</p></td></tr></table>' +
      '<p>Closing paragraph</p>'

    expect(mammothHtmlToLines(html)).toEqual([
      'Intro paragraph',
      'Cash: 5000',
      'Closing paragraph',
    ])
  })

  it('drops empty paragraphs and cells', () => {
    const html = '<p></p><table><tr><td><p></p></td><td><p>10</p></td></tr></table>'

    expect(mammothHtmlToLines(html)).toEqual(['10'])
  })
})
