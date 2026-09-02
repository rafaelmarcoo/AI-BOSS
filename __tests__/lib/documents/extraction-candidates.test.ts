import { extractDocumentCandidates } from '@/lib/documents/extraction-candidates'
import type { ParsedDocumentResult } from '@/lib/documents/types'

const emptyResult = {
  rawText: '',
  metadata: {},
  chunks: [],
} satisfies ParsedDocumentResult

describe('document extraction candidates', () => {
  it('creates XLSX candidates with worksheet and source-row evidence', () => {
    const candidates = extractDocumentCandidates({
      document: {
        id: 'document-1',
        file_name: 'financials.xlsx',
        file_type: 'xlsx',
      },
      parsedDocument: {
        ...emptyResult,
        tabularData: {
          sourceType: 'xlsx',
          selectedSheetNames: ['Summary'],
          suggestedSheetNames: ['Summary'],
          worksheetMetadata: [],
          warnings: [],
          sheets: [
            {
              name: 'Summary',
              visibility: 'visible',
              headers: ['Account', 'Amount', 'Currency', 'Date'],
              rows: [
                {
                  rowNumber: 4,
                  values: ['Cash', '120000', 'NZD', '2026-07-31'],
                  cells: {
                    Account: 'Cash',
                    Amount: '120000',
                    Currency: 'NZD',
                    Date: '2026-07-31',
                  },
                },
              ],
              headerRowNumber: 3,
              nonEmptyRowCount: 2,
              columnCount: 4,
              warnings: [],
            },
          ],
        },
      },
      extractedAt: '2026-08-26T00:00:00.000Z',
    })

    expect(candidates).toEqual([
      expect.objectContaining({
        metricKey: 'cash',
        value: 120000,
        currency: 'NZD',
        reportingDate: '2026-07-31',
        extractorVersion: 'deterministic_xlsx_v1',
        evidence: expect.objectContaining({
          sourceSheet: 'Summary',
          sourceRowStart: 4,
          sourceRowEnd: 4,
        }),
      }),
    ])
  })

  it('keeps unsupported currency in original evidence but not canonical fields', () => {
    const [candidate] = extractDocumentCandidates({
      document: {
        id: 'document-1',
        file_name: 'statement.pdf',
        file_type: 'pdf',
      },
      parsedDocument: {
        ...emptyResult,
        pdfPages: [
          {
            pageNumber: 1,
            text: 'As at 31 July 2026\nCash: 100,000 USD',
            lines: ['As at 31 July 2026', 'Cash: 100,000 USD'],
          },
        ],
      },
      extractedAt: '2026-08-26T00:00:00.000Z',
    })

    expect(candidate).toMatchObject({
      currency: null,
      originalPayload: { currency: 'USD' },
      warnings: [expect.objectContaining({ code: 'currency_unsupported' })],
    })
  })

  it('keeps a runway source currency only as audit evidence', () => {
    const [candidate] = extractDocumentCandidates({
      document: {
        id: 'document-1',
        file_name: 'financials.csv',
        file_type: 'csv',
      },
      parsedDocument: {
        ...emptyResult,
        tabularData: {
          sourceType: 'csv',
          selectedSheetNames: ['CSV'],
          suggestedSheetNames: ['CSV'],
          worksheetMetadata: [],
          warnings: [],
          sheets: [
            {
              name: 'CSV',
              visibility: 'visible',
              headers: ['Metric', 'Value', 'Currency', 'Date'],
              rows: [
                {
                  rowNumber: 2,
                  values: ['Runway', '7', 'NZD', '2026-07-31'],
                  cells: {
                    Metric: 'Runway',
                    Value: '7',
                    Currency: 'NZD',
                    Date: '2026-07-31',
                  },
                },
              ],
              headerRowNumber: 1,
              nonEmptyRowCount: 2,
              columnCount: 4,
              warnings: [],
            },
          ],
        },
      },
      extractedAt: '2026-08-26T00:00:00.000Z',
    })

    expect(candidate).toMatchObject({
      metricKey: 'runway_months',
      currency: null,
      originalPayload: { currency: 'NZD' },
      warnings: [expect.objectContaining({ code: 'currency_not_applicable' })],
    })
  })

  it('deduplicates identical candidates across selected worksheets', () => {
    const rows = [
      {
        rowNumber: 2,
        values: ['Cash', '100000', 'NZD', '2026-07-31'],
        cells: {
          Metric: 'Cash',
          Amount: '100000',
          Currency: 'NZD',
          Date: '2026-07-31',
        },
      },
    ]
    const sheet = (name: string) => ({
      name,
      visibility: 'visible' as const,
      headers: ['Metric', 'Amount', 'Currency', 'Date'],
      rows,
      headerRowNumber: 1,
      nonEmptyRowCount: 2,
      columnCount: 4,
      warnings: [],
    })
    const candidates = extractDocumentCandidates({
      document: {
        id: 'document-1',
        file_name: 'financials.xlsx',
        file_type: 'xlsx',
      },
      parsedDocument: {
        ...emptyResult,
        tabularData: {
          sourceType: 'xlsx',
          sheets: [sheet('Summary'), sheet('Duplicate')],
          selectedSheetNames: ['Summary', 'Duplicate'],
          suggestedSheetNames: ['Summary'],
          worksheetMetadata: [],
          warnings: [],
        },
      },
      extractedAt: '2026-08-26T00:00:00.000Z',
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0].warnings).toContainEqual(
      expect.objectContaining({ code: 'duplicate_omitted' })
    )
  })
})
