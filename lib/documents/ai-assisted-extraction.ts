import { HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { DOCUMENT_MODEL } from '@/lib/ai/model-config'
import type {
  DocumentExtractionCandidateDraft,
  ParsedDocumentResult,
} from '@/lib/documents/types'
import {
  resolveItemValue,
  toItemAttributes,
  type ExtractedItem,
} from '@/lib/financial-data/attributes'
import { FINANCIAL_METRIC_KEYS } from '@/lib/financial-data/metric-keys'
import type { Document } from '@/types/database'

const AiMetricSchema = z.object({
  metricKey: z.enum(FINANCIAL_METRIC_KEYS),
  value: z.number(),
  currency: z.enum(['NZD', 'AUD']).nullable(),
  reportingDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  evidenceExcerpt: z.string(),
})

const AiItemSchema = z.object({
  label: z.string(),
  value: z.number().nullable(),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])),
})

const AiDocumentExtractionSchema = z.object({
  metrics: z.array(AiMetricSchema),
  items: z.array(AiItemSchema),
})

const AI_EXTRACTION_PROMPT = `
Extract only financial facts visibly supported by this document.

Trusted-boundary rules:
- You are creating untrusted review candidates, not approved financial records.
- Never invent, forecast, convert currency, repair arithmetic, or infer a date/currency that is not shown.
- Only use the canonical metric keys provided by the response schema.
- monthly_revenue and monthly_expenses require a clearly monthly source period.
- runway_months has no currency. All other monetary metrics require visibly supported NZD or AUD; otherwise return null.
- reportingDate must be YYYY-MM-DD only when the source date is unambiguous; otherwise return null.
- Include a short verbatim evidence excerpt for every canonical metric.
- Also return supplementary line items with their original labels and useful attributes such as quantity, unit price, department, entity, period, or unit.
- If quantity and unit price are present but no total is printed, leave value null. The application will label any calculated total as computed metadata.
- Return empty arrays when the document contains no supported values.
`.trim()

export interface AiAssistedExtractionResult {
  candidates: DocumentExtractionCandidateDraft[]
  items: ExtractedItem[]
}

function candidateWarnings(metric: z.infer<typeof AiMetricSchema>) {
  const warnings: DocumentExtractionCandidateDraft['warnings'] = []
  if (metric.metricKey !== 'runway_months' && !metric.currency) {
    warnings.push({
      code: 'currency_missing',
      message: 'Choose NZD or AUD before including this AI-assisted candidate.',
    })
  }
  if (!metric.reportingDate) {
    warnings.push({
      code: 'reporting_date_missing',
      message: 'Add a reporting date before including this AI-assisted candidate.',
    })
  }
  return warnings
}

export async function extractAiAssistedDocument(params: {
  document: Pick<Document, 'id' | 'file_name' | 'file_type' | 'mime_type'>
  parsedDocument: ParsedDocumentResult
  fileBytes: Uint8Array
}): Promise<AiAssistedExtractionResult> {
  const model = new ChatOpenAI({
    model: DOCUMENT_MODEL,
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    useResponsesApi: true,
  }).withStructuredOutput(AiDocumentExtractionSchema, {
    name: 'ai_assisted_financial_document_extraction',
    strict: true,
  })

  const sourceBlock = params.parsedDocument.rawText.trim()
    ? {
        type: 'text' as const,
        text: `${AI_EXTRACTION_PROMPT}\n\nDOCUMENT TEXT:\n${params.parsedDocument.rawText.slice(0, 120_000)}`,
      }
    : null

  const content = sourceBlock
    ? [sourceBlock]
    : [
        { type: 'text' as const, text: AI_EXTRACTION_PROMPT },
        {
          type: 'file' as const,
          data: params.fileBytes,
          mimeType: params.document.mime_type || 'application/pdf',
          metadata: { filename: params.document.file_name },
        },
      ]

  const result = await model.invoke([new HumanMessage({ content })])
  const items = result.items.flatMap((item) => {
    const resolved = resolveItemValue({
      value: item.value,
      attributes: toItemAttributes(item.attributes),
    })
    if (!item.label.trim() || resolved.value === null) return []
    return [{
      label: item.label.trim(),
      value: resolved.value,
      attributes: resolved.attributes,
    }]
  })

  return {
    candidates: result.metrics.map((metric) => ({
      originalPayload: { ...metric },
      metricKey: metric.metricKey,
      value: metric.value,
      currency: metric.metricKey === 'runway_months' ? null : metric.currency,
      reportingDate: metric.reportingDate,
      confidence: metric.confidence,
      evidence: {
        documentId: params.document.id,
        sourceType: params.document.file_type,
        excerpt: metric.evidenceExcerpt,
        extractionMethod: 'ai_assisted',
      },
      warnings: candidateWarnings(metric),
      extractorVersion: 'openai_assisted_v1',
    })),
    items,
  }
}
