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
import {
  DOCUMENT_CATEGORIES,
  type DocumentCategory,
} from '@/lib/documents/categories'

const MAX_AI_TEXT_CHARACTERS = 120_000

const AiMetricSchema = z.object({
  metricKey: z.enum(FINANCIAL_METRIC_KEYS),
  value: z.number(),
  currency: z.enum(['NZD', 'AUD']).nullable(),
  reportingDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  evidenceExcerpt: z.string(),
  currencyBasis: z.enum(['explicit', 'inferred', 'unknown']),
  currencyEvidence: z.string().nullable(),
  sourcePage: z.number().int().positive().nullable(),
  sourceRow: z.number().int().positive().nullable(),
  sourceSheet: z.string().nullable(),
})

const AiItemSchema = z.object({
  label: z.string(),
  value: z.number().nullable(),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])),
  evidenceExcerpt: z.string(),
})

const AiDocumentTotalSchema = z.object({
  value: z.number(),
  currency: z.enum(['NZD', 'AUD']).nullable(),
  currencyBasis: z.enum(['explicit', 'inferred', 'unknown']),
  currencyEvidence: z.string().nullable(),
  reportingDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  evidenceExcerpt: z.string(),
})

const AiDocumentExtractionSchema = z.object({
  documentCategory: z.enum(DOCUMENT_CATEGORIES),
  transcription: z.string(),
  documentTotal: AiDocumentTotalSchema.nullable(),
  metrics: z.array(AiMetricSchema),
  items: z.array(AiItemSchema),
})

const AI_EXTRACTION_PROMPT = `
Extract only financial facts visibly supported by this document.

Trusted-boundary rules:
- You are creating untrusted review candidates, not approved financial records.
- Never invent, forecast, convert currency, repair arithmetic, or infer a date/currency except for the narrow location-based currency suggestion below.
- Classify the document using one of the supplied documentCategory values.
- For a receipt or invoice, documentTotal is only the explicitly labelled final total. Do not use subtotal, tax, change, payment amount or a calculated sum. Keep it neutral rather than mapping it to a canonical metric.
- Only use the canonical metric keys provided by the response schema.
- monthly_revenue and monthly_expenses require a clearly monthly source period.
- runway_months has no currency. For other metrics, use explicit NZD/AUD when printed. You may suggest NZD/AUD from a lone "$" only when strong visible country evidence exists; mark currencyBasis=inferred and quote that evidence. Otherwise return null and unknown.
- reportingDate must be YYYY-MM-DD only when the source date is unambiguous; otherwise return null.
- Include a short verbatim evidence excerpt for every canonical metric.
- Also return supplementary line items with their original labels and useful attributes such as quantity, unit price, department, entity, period, or unit.
- If quantity and unit price are present but no total is printed, leave value null. The application will label any calculated total as computed metadata.
- Preserve a transcription of the readable source text. For parsed CSV/XLSX text, repeat only the relevant readable rows rather than inventing prose.
- Return empty arrays when the document contains no supported values.
`.trim()

export interface AiAssistedExtractionResult {
  candidates: DocumentExtractionCandidateDraft[]
  items: ExtractedItem[]
  documentCategory: DocumentCategory
  transcription: string
  inputTruncated: boolean
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
  if (metric.currencyBasis === 'inferred' && metric.currency) {
    warnings.push({
      code: 'currency_inferred',
      message: `The currency was inferred from visible context${metric.currencyEvidence ? `: ${metric.currencyEvidence}` : ''}. Confirm it against the original.`,
    })
  }
  return warnings
}

function documentTotalWarnings(
  total: z.infer<typeof AiDocumentTotalSchema>
) {
  const warnings: DocumentExtractionCandidateDraft['warnings'] = [{
    code: 'metric_selection_required',
    message: 'Choose the financial meaning of this total before including it.',
  }]
  if (!total.currency) {
    warnings.push({
      code: 'currency_missing',
      message: 'Choose NZD or AUD before including this document total.',
    })
  }
  if (total.currencyBasis === 'inferred' && total.currency) {
    warnings.push({
      code: 'currency_inferred',
      message: `The currency was inferred from visible context${total.currencyEvidence ? `: ${total.currencyEvidence}` : ''}. Confirm it against the original.`,
    })
  }
  if (!total.reportingDate) {
    warnings.push({
      code: 'reporting_date_missing',
      message: 'Add a reporting date before including this document total.',
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

  const fullText = params.parsedDocument.rawText.trim()
  const inputTruncated = fullText.length > MAX_AI_TEXT_CHARACTERS
  const sourceBlock = fullText
    ? {
        type: 'text' as const,
        text: `${AI_EXTRACTION_PROMPT}\n\nDOCUMENT TEXT:\n${fullText.slice(0, MAX_AI_TEXT_CHARACTERS)}`,
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
      attributes: {
        ...resolved.attributes,
        ...(item.evidenceExcerpt.trim()
          ? { 'source evidence': item.evidenceExcerpt.trim() }
          : {}),
      },
    }]
  })

  const metricCandidates = result.metrics.map((metric) => ({
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
        ...(metric.sourcePage ? { sourcePage: metric.sourcePage } : {}),
        ...(metric.sourceRow ? { sourceRowStart: metric.sourceRow } : {}),
        ...(metric.sourceSheet ? { sourceSheet: metric.sourceSheet } : {}),
        currencyBasis: metric.currencyBasis,
        ...(metric.currencyEvidence
          ? { currencyEvidence: metric.currencyEvidence }
          : {}),
      },
      warnings: candidateWarnings(metric),
      extractorVersion: 'openai_assisted_v1',
    })) satisfies DocumentExtractionCandidateDraft[]
  const totalCandidate = result.documentTotal
    ? [{
        originalPayload: {
          documentCategory: result.documentCategory,
          documentTotal: { ...result.documentTotal },
        },
        metricKey: null,
        value: result.documentTotal.value,
        currency: result.documentTotal.currency,
        reportingDate: result.documentTotal.reportingDate,
        confidence: result.documentTotal.confidence,
        evidence: {
          documentId: params.document.id,
          sourceType: params.document.file_type,
          excerpt: result.documentTotal.evidenceExcerpt,
          extractionMethod: 'ai_assisted',
          currencyBasis: result.documentTotal.currencyBasis,
          ...(result.documentTotal.currencyEvidence
            ? { currencyEvidence: result.documentTotal.currencyEvidence }
            : {}),
        },
        warnings: documentTotalWarnings(result.documentTotal),
        extractorVersion: 'openai_assisted_v1',
      } satisfies DocumentExtractionCandidateDraft]
    : []

  return {
    candidates: [...totalCandidate, ...metricCandidates],
    items,
    documentCategory: result.documentCategory,
    transcription: result.transcription.trim(),
    inputTruncated,
  }
}
