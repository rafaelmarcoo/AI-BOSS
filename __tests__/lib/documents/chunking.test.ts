import { createCsvChunks, createPdfChunks } from '@/lib/documents/chunking'
import { parseDocumentContent } from '@/lib/documents/parsing'

describe('document chunking', () => {
  it('creates csv chunks with row metadata', async () => {
    const csv = Buffer.from(
      'month,revenue,expenses\nJan,1000,600\nFeb,1200,700\nMar,900,650'
    )
    const result = await parseDocumentContent(
      {
        id: 'doc-1',
        user_id: 'user-1',
        file_type: 'csv',
        file_name: 'forecast.csv',
      },
      csv
    )

    expect(result.metadata).toMatchObject({
      headers: ['month', 'revenue', 'expenses'],
      rowCount: 3,
    })
    expect(result.chunks[0]).toMatchObject({
      document_id: 'doc-1',
      user_id: 'user-1',
      chunk_index: 0,
      source_page: null,
    })
    expect(result.rawText).toContain('Row 1')
    expect(result.rawText).toContain('month: Jan')
    expect(result.csvData?.headers).toEqual(['month', 'revenue', 'expenses'])
    expect(result.csvData?.rows).toHaveLength(3)
    expect(result.csvData?.rows[0]).toMatchObject({
      rowNumber: 1,
      values: ['Jan', '1000', '600'],
      cells: {
        month: 'Jan',
        revenue: '1000',
        expenses: '600',
      },
    })
  })

  it('skips csv title rows before the real header row', async () => {
    const csv = Buffer.from(
      [
        'Table 1',
        'Account,Amount,Currency,Date,,,',
        'Cash at bank,120000,NZD,2026-05-12,,,',
        'Debtors,45000,NZD,2026-05-12,,,',
      ].join('\r\n')
    )
    const result = await parseDocumentContent(
      {
        id: 'doc-1',
        user_id: 'user-1',
        file_type: 'csv',
        file_name: 'test csv.csv',
      },
      csv
    )

    expect(result.metadata).toMatchObject({
      headers: [
        'Account',
        'Amount',
        'Currency',
        'Date',
        'column_5',
        'column_6',
        'column_7',
      ],
      rowCount: 2,
      skippedRowCount: 1,
    })
    expect(result.rawText).toContain('Account: Cash at bank')
    expect(result.rawText).toContain('Amount: 120000')
    expect(result.csvData?.rows[0]?.cells).toMatchObject({
      Account: 'Cash at bank',
      Amount: '120000',
      Currency: 'NZD',
      Date: '2026-05-12',
    })
  })

  it('creates page-aware pdf chunks', () => {
    const chunks = createPdfChunks({
      documentId: 'doc-1',
      userId: 'user-1',
      pages: [
        {
          pageNumber: 1,
          text: 'Cash flow summary '.repeat(120),
        },
      ],
    })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.source_page === 1)).toBe(true)
    expect(chunks[0]?.chunk_index).toBe(0)
  })

  it('groups csv rows into ordered chunks', () => {
    const chunks = createCsvChunks({
      documentId: 'doc-1',
      userId: 'user-1',
      headers: ['month', 'value'],
      rowBlocks: Array.from({ length: 10 }, (_, index) =>
        `Row ${index + 1}\nmonth: Month ${index + 1}\nvalue: ${index + 1}`
      ),
    })

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]?.metadata).toMatchObject({
      source: 'csv',
      rowStart: 1,
    })
  })
})
