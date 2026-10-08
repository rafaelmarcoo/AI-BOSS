import { HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'
import { DOCUMENT_MODEL } from '@/lib/ai/model-config'
import type { ParsedImageExtraction } from '@/lib/documents/types'
import { DOCUMENT_CATEGORIES } from '@/lib/documents/categories'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'

const ImageItemSchema = z.object({
  label: z.string(),
  value: z.number().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unitPrice: z.number().nullable(),
  evidenceExcerpt: z.string(),
})

const ImageMetricSchema = z.object({
  metricKey: z.enum(FINANCIAL_METRIC_KEYS),
  value: z.number(),
  currency: z.enum(['NZD', 'AUD']).nullable(),
  reportingDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  evidenceExcerpt: z.string(),
})

const ImageExtractionSchema = z.object({
  documentCategory: z.enum(DOCUMENT_CATEGORIES),
  documentType: z.enum(['invoice', 'receipt', 'statement', 'other']),
  supplier: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  documentDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  currency: z.enum(['NZD', 'AUD']).nullable(),
  currencyBasis: z.enum(['explicit', 'inferred', 'unknown']),
  currencyEvidence: z.string().nullable(),
  totalAmount: z.number().nullable(),
  totalEvidence: z.string().nullable(),
  metrics: z.array(ImageMetricSchema),
  items: z.array(ImageItemSchema),
  transcription: z.string(),
})

const IMAGE_EXTRACTION_PROMPT = `
Transcribe this financial document and extract only facts visibly supported by the image.

Rules:
- Classify the business meaning using one of the supplied documentCategory values. CSV/spreadsheet-like exports are data_export. Informal handwritten notes are other.
- Preserve every purchased/component or handwritten financial line as an item. Keep quantities, units and unit prices separate. Do not repeat receipt subtotal, tax, payment, change or final total as items.
- For a receipt or invoice, totalAmount is only the explicitly labelled final total. Do not use subtotal, tax, change, payment amount or a calculated sum as the document total.
- Do not map a receipt or invoice total to an AI-BOSS metric. It must remain neutral for human review.
- Only put a value in metrics when the source visibly supports a complete canonical metric. monthly_revenue and monthly_expenses require a clearly monthly reporting period. Put incomplete or component values in items instead.
- Use ISO YYYY-MM-DD only when a printed date is unambiguous. Convert compact dates such as 26Aug26 to 2026-08-26.
- When NZD or AUD is printed, currencyBasis is explicit. When only "$" is printed, you may suggest NZD or AUD only from strong visible country evidence such as a New Zealand/Australian address, domain or tax identifier; set currencyBasis to inferred and quote that evidence. Otherwise use unknown and null.
- Apply the document-level currency to metrics/items only when the same currency clearly applies.
- Do not calculate missing values or repair inconsistent arithmetic.
- Evidence excerpts must be short exact text from the image.
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
      'The document image could not be read. Keep the original and try again.'
    )
  }
}
