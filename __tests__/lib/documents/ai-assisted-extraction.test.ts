import { extractAiAssistedDocument } from '@/lib/documents/ai-assisted-extraction'

const mockInvoke = jest.fn()
const mockWithStructuredOutput = jest.fn(() => ({ invoke: mockInvoke }))

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn(() => ({
    withStructuredOutput: mockWithStructuredOutput,
  })),
}))

describe('AI-assisted document extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps an explicit receipt total neutral and review-gated', async () => {
    mockInvoke.mockResolvedValue({
      documentCategory: 'invoice_receipt',
      transcription: 'New World Botany\nTOTAL $26.46\n26Aug26',
      documentTotal: {
        value: 26.46,
        currency: 'NZD',
        currencyBasis: 'inferred',
        currencyEvidence: 'New World Botany, Auckland, New Zealand',
        reportingDate: '2026-08-26',
        confidence: 0.9,
        evidenceExcerpt: 'TOTAL $26.46',
      },
      metrics: [],
      items: [
        {
          label: 'Fanta Orange 2.25L',
          value: 5.49,
          attributes: { quantity: 1, 'unit price': 5.49 },
          evidenceExcerpt: 'FANTA ORANGE 2.25L $5.49',
        },
      ],
    })

    const result = await extractAiAssistedDocument({
      document: {
        id: 'document-1',
        file_name: 'receipt.pdf',
        file_type: 'pdf',
        mime_type: 'application/pdf',
      },
      parsedDocument: {
        rawText: 'New World Botany TOTAL $26.46 26Aug26',
        metadata: {},
        chunks: [],
      },
      fileBytes: Buffer.from('pdf'),
    })

    expect(result).toMatchObject({
      documentCategory: 'invoice_receipt',
      candidates: [
        {
          metricKey: null,
          value: 26.46,
          currency: 'NZD',
          reportingDate: '2026-08-26',
          evidence: { excerpt: 'TOTAL $26.46' },
          warnings: expect.arrayContaining([
            expect.objectContaining({ code: 'metric_selection_required' }),
            expect.objectContaining({ code: 'currency_inferred' }),
          ]),
        },
      ],
      items: [
        expect.objectContaining({ label: 'Fanta Orange 2.25L', value: 5.49 }),
      ],
    })
  })

  it('bounds parsed text sent to the model and reports truncation', async () => {
    mockInvoke.mockResolvedValue({
      documentCategory: 'data_export',
      transcription: '',
      documentTotal: null,
      metrics: [],
      items: [],
    })

    const result = await extractAiAssistedDocument({
      document: {
        id: 'document-1',
        file_name: 'large.csv',
        file_type: 'csv',
        mime_type: 'text/csv',
      },
      parsedDocument: {
        rawText: 'x'.repeat(120_001),
        metadata: {},
        chunks: [],
      },
      fileBytes: Buffer.from('unused'),
    })

    expect(result.inputTruncated).toBe(true)
    const message = mockInvoke.mock.calls[0][0][0]
    const content = message.content as Array<{ type: string; text?: string }>
    expect(content).toHaveLength(1)
    expect(content[0].text?.length).toBeLessThan(122_000)
  })
})
