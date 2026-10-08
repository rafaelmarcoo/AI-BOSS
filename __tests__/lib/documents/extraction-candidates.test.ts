import {
  extractDocumentCandidates,
  extractImageItems,
} from '@/lib/documents/extraction-candidates'
import type { ParsedDocumentResult } from '@/lib/documents/types'

const emptyResult = {
  rawText: '',
  metadata: {},
  chunks: [],
} satisfies ParsedDocumentResult

describe('document extraction candidates', () => {
  it('keeps an invoice total neutral until an admin chooses its metric', () => {
    const [candidate] = extractDocumentCandidates({
      document: {
        id: 'document-1',
        file_name: 'invoice.png',
        file_type: 'image',
      },
      parsedDocument: {
        ...emptyResult,
        imageExtraction: {
          documentCategory: 'invoice_receipt',
          documentType: 'invoice',
          supplier: 'Example Supplies',
          invoiceNumber: 'INV-1042',
          documentDate: '2026-09-28',
          dueDate: '2026-10-20',
          currency: 'NZD',
          currencyBasis: 'explicit',
          currencyEvidence: 'NZD',
          totalAmount: 460,
          totalEvidence: 'Total NZD 460',
          metrics: [],
          items: [
            {
              label: 'Paper boxes',
              value: 400,
              quantity: 4,
              unit: 'box',
              unitPrice: 100,
              evidenceExcerpt: '4 boxes @ NZD 100 = NZD 400',
            },
          ],
          transcription: 'Invoice INV-1042 Total NZD 460',
        },
      },
      extractedAt: '2026-09-29T00:00:00.000Z',
    })

    expect(candidate).toMatchObject({
      metricKey: null,
      value: 460,
      currency: 'NZD',
      reportingDate: '2026-09-28',
      extractorVersion: 'openai_image_financial_v2',
      originalPayload: {
        totalAmount: 460,
        items: [expect.objectContaining({ quantity: 4, value: 400 })],
      },
      warnings: [
        expect.objectContaining({ code: 'metric_selection_required' }),
      ],
    })
  })

  it('keeps inferred receipt currency visible as a review warning', () => {
    const [candidate] = extractDocumentCandidates({
      document: {
        id: 'document-1',
        file_name: 'receipt.jpg',
        file_type: 'image',
      },
      parsedDocument: {
        ...emptyResult,
        imageExtraction: {
          documentCategory: 'invoice_receipt',
          documentType: 'receipt',
          supplier: 'New World Botany',
          invoiceNumber: null,
          documentDate: '2026-08-26',
          dueDate: null,
          currency: 'NZD',
          currencyBasis: 'inferred',
          currencyEvidence: 'New Zealand store address and EFTPOS receipt',
          totalAmount: 26.46,
          totalEvidence: 'TOTAL $26.46',
          metrics: [],
          items: [],
          transcription: 'TOTAL $26.46 26Aug26',
        },
      },
      extractedAt: '2026-08-26T03:00:00.000Z',
    })

    expect(candidate).toMatchObject({
      metricKey: null,
      value: 26.46,
      currency: 'NZD',
      reportingDate: '2026-08-26',
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: 'metric_selection_required' }),
        expect.objectContaining({ code: 'currency_inferred' }),
      ]),
    })
  })

  it('preserves handwritten financial lines as editable supplementary Items', () => {
    const items = extractImageItems({
        ...emptyResult,
        imageExtraction: {
          documentCategory: 'other',
          documentType: 'other',
          supplier: null,
          invoiceNumber: null,
          documentDate: null,
          dueDate: null,
          currency: null,
          currencyBasis: 'unknown',
          currencyEvidence: null,
          totalAmount: null,
          totalEvidence: null,
          metrics: [],
          items: [
            { label: 'Food Expenses', value: 23.14, quantity: null, unit: null, unitPrice: null, evidenceExcerpt: 'Food Expenses: 23.14' },
            { label: 'Icecream Expense', value: 11.15, quantity: null, unit: null, unitPrice: null, evidenceExcerpt: 'Icecream Expense: 11.15' },
            { label: 'Wood selling Revenue', value: 100, quantity: null, unit: null, unitPrice: null, evidenceExcerpt: 'Wood selling Revenue: 100' },
            { label: 'Car selling Revenue', value: 1700, quantity: null, unit: null, unitPrice: null, evidenceExcerpt: 'Car selling Revenue: 1700' },
          ],
          transcription: 'Food Expenses: 23.14\nIcecream Expense: 11.15\nWood selling Revenue: 100\nCar selling Revenue: 1700',
        },
    })

    expect(items).toHaveLength(4)
    expect(items).toMatchObject([
      { label: 'Food Expenses', value: 23.14 },
      { label: 'Icecream Expense', value: 11.15 },
      { label: 'Wood selling Revenue', value: 100 },
      { label: 'Car selling Revenue', value: 1700 },
    ])
  })

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
