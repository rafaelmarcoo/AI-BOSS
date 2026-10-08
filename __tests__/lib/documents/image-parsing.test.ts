import { extractImageDocument } from '@/lib/documents/image-extraction'
import { parseDocumentContent } from '@/lib/documents/parsing'

jest.mock('@/lib/documents/image-extraction', () => ({
  extractImageDocument: jest.fn(),
}))

const mockExtractImageDocument = jest.mocked(extractImageDocument)

describe('image document parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the original image MIME type and retains review evidence', async () => {
    mockExtractImageDocument.mockResolvedValue({
      documentCategory: 'invoice_receipt',
      documentType: 'invoice',
      supplier: 'Example Supplies',
      invoiceNumber: 'INV-1042',
      documentDate: '2026-09-28',
      dueDate: null,
      currency: 'NZD',
      currencyBasis: 'explicit',
      currencyEvidence: 'NZD',
      totalAmount: 460,
      totalEvidence: 'Total NZD 460',
      metrics: [],
      items: [],
      transcription: 'Example Supplies\nInvoice INV-1042\nTotal NZD 460',
    })
    const fileBytes = new Uint8Array([137, 80, 78, 71])

    const result = await parseDocumentContent(
      {
        id: 'document-1',
        user_id: 'user-1',
        file_name: 'invoice.png',
        file_type: 'image',
        mime_type: 'image/png',
      },
      fileBytes
    )

    expect(mockExtractImageDocument).toHaveBeenCalledWith(
      fileBytes,
      'image/png'
    )
    expect(result).toMatchObject({
      rawText: 'Example Supplies\nInvoice INV-1042\nTotal NZD 460',
      imageExtraction: {
        invoiceNumber: 'INV-1042',
        totalAmount: 460,
      },
      chunks: [
        expect.objectContaining({
          document_id: 'document-1',
          user_id: 'user-1',
          metadata: { source: 'image' },
        }),
      ],
    })
  })
})
