/** @jest-environment node */

import {
  mammothHtmlToLines,
  parseDocumentContent,
} from '@/lib/documents/parsing'

jest.mock('mammoth', () => ({
  convertToHtml: jest.fn(async () => ({
    value:
      '<p>Statement date: 31/05/2026</p>' +
      '<table><tr><th>Account</th><th>Amount</th></tr>' +
      '<tr><td>Cash at bank</td><td>120000 NZD</td></tr></table>',
    messages: [],
  })),
}))

describe('text and DOCX document parsing', () => {
  it('creates retrieval chunks and line evidence for plain text', async () => {
    const result = await parseDocumentContent(
      {
        id: 'document-1',
        user_id: 'user-1',
        file_type: 'text',
        file_name: 'notes.txt',
      },
      Buffer.from('Statement date: 31/05/2026\nCash at bank: 120000 NZD')
    )

    expect(result).toMatchObject({
      extractionState: 'text',
      metadata: { sourceType: 'text' },
      pdfPages: [expect.objectContaining({ pageNumber: 1 })],
    })
    expect(result.chunks).toEqual([
      expect.objectContaining({ metadata: { source: 'text' } }),
    ])
  })

  it('preserves DOCX table rows on one line for deterministic review candidates', async () => {
    const result = await parseDocumentContent(
      {
        id: 'document-1',
        user_id: 'user-1',
        file_type: 'docx',
        file_name: 'statement.docx',
      },
      Buffer.from('mock DOCX package')
    )

    expect(result.rawText).toContain('Cash at bank: 120000 NZD')
    expect(result.chunks[0]).toMatchObject({ metadata: { source: 'docx' } })
  })

  it('keeps non-table paragraphs and converts each table row separately', () => {
    expect(
      mammothHtmlToLines(
        '<p>Overview</p><table><tr><td>Quantity</td><td>2</td></tr>' +
          '<tr><td>Unit price</td><td>5</td></tr></table>'
      )
    ).toEqual(['Overview', 'Quantity: 2', 'Unit price: 5'])
  })
})
