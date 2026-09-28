import { HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'
import { DOCUMENT_MODEL } from '@/lib/ai/model-config'
import type { ParsedImageExtraction } from '@/lib/documents/types'

const InvoiceLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unitPrice: z.number().nullable(),
  lineTotal: z.number().nullable(),
})

const ImageExtractionSchema = z.object({
  documentType: z.enum(['invoice', 'receipt', 'statement', 'other']),
  supplier: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  currency: z.string().nullable(),
  totalAmount: z.number().nullable(),
  lineItems: z.array(InvoiceLineItemSchema),
  transcription: z.string(),
})

const IMAGE_EXTRACTION_PROMPT = `
Transcribe this financial document and extract only values visibly supported by the image.

Rules:
- Preserve quantities, units, unit prices, and monetary totals as separate fields.
- totalAmount is the explicitly labelled final invoice or receipt total, not a quantity, subtotal, tax amount, or a calculated sum.
- Use an ISO YYYY-MM-DD date only when the visible date is unambiguous; otherwise return null.
- Return the visible three-letter currency code when present. Do not guess a currency from a symbol alone.
- Do not map the total to accounts payable, monthly expenses, revenue, or any other AI-BOSS metric.
- Do not calculate missing values or repair inconsistent arithmetic.
- transcription must contain all readable source text needed for human review.
`.trim()

export async function extractImageDocument(
  fileBytes: Uint8Array,
  mimeType: string
): Promise<ParsedImageExtraction> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Image extraction requires OPENAI_API_KEY.'
    )
  }

  const model = new ChatOpenAI({
    model: DOCUMENT_MODEL,
    apiKey,
    temperature: 0,
    useResponsesApi: true,
  }).withStructuredOutput(ImageExtractionSchema, {
    name: 'financial_document_image_extraction',
    strict: true,
  })

  try {
    return await model.invoke([
      new HumanMessage({
        content: [
          { type: 'text', text: IMAGE_EXTRACTION_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${Buffer.from(fileBytes).toString('base64')}`,
              detail: 'high',
            },
          },
        ],
      }),
    ])
  } catch (error) {
    console.error('Failed to extract the uploaded image.', error)
    throw new ApiError(
      502,
      'INTERNAL_ERROR',
      'The invoice image could not be read. Keep the original and try again.'
    )
  }
}
