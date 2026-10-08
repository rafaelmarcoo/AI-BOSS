import type { ParsedDocumentResult } from '@/lib/documents/types'
import type { DocumentExtractionCandidateDraft } from '@/lib/documents/types'
import { extractCsvFinancialMetrics } from '@/lib/financial-data/extraction/csv'
import { extractPdfFinancialMetrics } from '@/lib/financial-data/extraction/pdf'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data'
import type { Document } from '@/types/database'
import {
  resolveItemValue,
  type ExtractedItem,
} from '@/lib/financial-data/attributes'

const EXTRACTOR_VERSIONS = {
  csv: 'deterministic_csv_v2',
  xlsx: 'deterministic_xlsx_v1',
  pdf: 'deterministic_pdf_v1',
  image: 'openai_image_financial_v2',
  text: 'hybrid_text_v1',
  docx: 'hybrid_docx_v1',
} as const

function candidateWarnings(metric: AvailableFinancialMetricValue) {
  const warnings: DocumentExtractionCandidateDraft['warnings'] = []

  if (metric.key === 'runway_months' && metric.currency) {
    warnings.push({
      code: 'currency_not_applicable',
      message:
        'Runway is measured in months, so its source currency was removed from the calculation candidate.',
    })
  } else if (metric.key !== 'runway_months' && !metric.currency) {
    warnings.push({
      code: 'currency_missing',
      message: 'Choose NZD or AUD before including this candidate.',
    })
  } else if (
    metric.key !== 'runway_months' &&
    metric.currency !== 'NZD' &&
    metric.currency !== 'AUD'
  ) {
    warnings.push({
      code: 'currency_unsupported',
      message: `${metric.currency} cannot be used for calculations; choose NZD or AUD or exclude this candidate.`,
    })
  }

  if (!metric.asOfDate && !metric.periodEnd) {
    warnings.push({
      code: 'reporting_date_missing',
      message: 'Add a reporting date before including this candidate.',
    })
  }

  return warnings
}

function metricToCandidate(
  metric: AvailableFinancialMetricValue,
  extractorVersion: string
): DocumentExtractionCandidateDraft {
  const evidence = metric.provenance.evidence ?? {}
  const supportedCurrency =
    metric.key !== 'runway_months' &&
    (metric.currency === 'NZD' || metric.currency === 'AUD')
      ? metric.currency
      : null

  return {
    originalPayload: {
      metricKey: metric.key,
      value: metric.value,
      currency: metric.currency,
      periodStart: metric.periodStart,
      periodEnd: metric.periodEnd,
      asOfDate: metric.asOfDate,
      confidence: metric.confidence,
      evidence,
    },
    metricKey: metric.key,
    value: metric.value,
    currency: supportedCurrency,
    reportingDate: metric.asOfDate ?? metric.periodEnd,
    confidence: metric.confidence,
    evidence: { ...evidence },
    warnings: candidateWarnings(metric),
    extractorVersion,
  }
}

function deduplicateCandidates(candidates: DocumentExtractionCandidateDraft[]) {
  const unique = new Map<string, DocumentExtractionCandidateDraft>()

  for (const candidate of candidates) {
    const signature = JSON.stringify([
      candidate.metricKey,
      candidate.value,
      candidate.currency,
      candidate.reportingDate,
    ])
    const existing = unique.get(signature)

    if (existing) {
      if (!existing.warnings.some((warning) => warning.code === 'duplicate_omitted')) {
        existing.warnings.push({
          code: 'duplicate_omitted',
          message: 'An identical extracted candidate was omitted from this review.',
        })
      }
      continue
    }

    unique.set(signature, candidate)
  }

  return [...unique.values()]
}

function imageCandidateWarnings(params: {
  metricKey: DocumentExtractionCandidateDraft['metricKey']
  currency: 'NZD' | 'AUD' | null
  reportingDate: string | null
  currencyBasis: 'explicit' | 'inferred' | 'unknown'
  currencyEvidence: string | null
}) {
  const warnings: DocumentExtractionCandidateDraft['warnings'] = []

  if (params.metricKey === null) {
    warnings.push({
      code: 'metric_selection_required',
      message:
        'Choose the financial meaning of this total before including it.',
    })
  }
  if (params.metricKey !== 'runway_months' && !params.currency) {
    warnings.push({
      code: 'currency_missing',
      message: 'Choose NZD or AUD before including this image value.',
    })
  }
  if (params.currencyBasis === 'inferred' && params.currency) {
    warnings.push({
      code: 'currency_inferred',
      message: `The currency was inferred from visible context${params.currencyEvidence ? `: ${params.currencyEvidence}` : ''}. Confirm it against the original.`,
    })
  }
  if (!params.reportingDate) {
    warnings.push({
      code: 'reporting_date_missing',
      message: 'Add a reporting date before including this image value.',
    })
  }
  return warnings
}

export function extractImageItems(
  parsedDocument: ParsedDocumentResult
): ExtractedItem[] {
  return (parsedDocument.imageExtraction?.items ?? []).flatMap((item) => {
    const attributes = {
      ...(item.quantity === null ? {} : { quantity: item.quantity }),
      ...(item.unit === null ? {} : { unit: item.unit }),
      ...(item.unitPrice === null ? {} : { 'unit price': item.unitPrice }),
      ...(item.evidenceExcerpt.trim()
        ? { 'source evidence': item.evidenceExcerpt.trim() }
        : {}),
    }
    const resolved = resolveItemValue({ value: item.value, attributes })
    if (!item.label.trim() || resolved.value === null) return []

    return [{
      label: item.label.trim(),
      value: resolved.value,
      attributes: resolved.attributes,
    }]
  })
}

export function extractDocumentCandidates(params: {
  document: Pick<Document, 'id' | 'file_name' | 'file_type'>
  parsedDocument: ParsedDocumentResult
  extractedAt: string
}) {
  if (params.document.file_type === 'image') {
    const extraction = params.parsedDocument.imageExtraction
    if (!extraction) return []

    const candidates: DocumentExtractionCandidateDraft[] = extraction.metrics.map(
      (metric) => ({
        originalPayload: { ...metric },
        metricKey: metric.metricKey,
        value: metric.value,
        currency:
          metric.metricKey === 'runway_months' ? null : metric.currency,
        reportingDate: metric.reportingDate,
        confidence: metric.confidence,
        evidence: {
          documentId: params.document.id,
          sourceType: 'image',
          excerpt: metric.evidenceExcerpt,
          extractionMethod: 'ai_assisted',
          currencyBasis: extraction.currencyBasis,
          ...(extraction.currencyEvidence
            ? { currencyEvidence: extraction.currencyEvidence }
            : {}),
        },
        warnings: imageCandidateWarnings({
          metricKey: metric.metricKey,
          currency: metric.currency,
          reportingDate: metric.reportingDate,
          currencyBasis: extraction.currencyBasis,
          currencyEvidence: extraction.currencyEvidence,
        }),
        extractorVersion: EXTRACTOR_VERSIONS.image,
      })
    )

    if (extraction.totalAmount !== null) {
      candidates.unshift({
        originalPayload: {
          documentType: extraction.documentType,
          documentCategory: extraction.documentCategory,
          supplier: extraction.supplier,
          invoiceNumber: extraction.invoiceNumber,
          documentDate: extraction.documentDate,
          dueDate: extraction.dueDate,
          currency: extraction.currency,
          currencyBasis: extraction.currencyBasis,
          totalAmount: extraction.totalAmount,
          items: extraction.items,
        },
        metricKey: null,
        value: extraction.totalAmount,
        currency: extraction.currency,
        reportingDate: extraction.documentDate,
        confidence: 0.8,
        evidence: {
          documentId: params.document.id,
          sourceType: 'image',
          supplier: extraction.supplier,
          invoiceNumber: extraction.invoiceNumber,
          excerpt:
            extraction.totalEvidence ?? extraction.transcription.slice(0, 500),
          extractionMethod: 'ai_assisted',
          currencyBasis: extraction.currencyBasis,
          ...(extraction.currencyEvidence
            ? { currencyEvidence: extraction.currencyEvidence }
            : {}),
        },
        warnings: imageCandidateWarnings({
          metricKey: null,
          currency: extraction.currency,
          reportingDate: extraction.documentDate,
          currencyBasis: extraction.currencyBasis,
          currencyEvidence: extraction.currencyEvidence,
        }),
        extractorVersion: EXTRACTOR_VERSIONS.image,
      })
    }

    return deduplicateCandidates(candidates)
  }

  if (
    params.document.file_type === 'pdf' ||
    params.document.file_type === 'text' ||
    params.document.file_type === 'docx'
  ) {
    const metrics = params.parsedDocument.pdfPages
      ? extractPdfFinancialMetrics({
          pages: params.parsedDocument.pdfPages,
          documentId: params.document.id,
          sourceLabel: params.document.file_name,
          extractedAt: params.extractedAt,
        })
      : []

    return metrics.map((metric) =>
      metricToCandidate(metric, EXTRACTOR_VERSIONS[params.document.file_type])
    )
  }

  if (!params.parsedDocument.tabularData) return []

  const extractorVersion = EXTRACTOR_VERSIONS[params.document.file_type]
  const candidates = params.parsedDocument.tabularData.sheets.flatMap((sheet) => {
    const metrics = extractCsvFinancialMetrics({
      csvData: { headers: sheet.headers, rows: sheet.rows },
      documentId: params.document.id,
      sourceLabel: params.document.file_name,
      extractedAt: params.extractedAt,
    })

    return metrics.map((metric) =>
      metricToCandidate(
        {
          ...metric,
          provenance: {
            ...metric.provenance,
            evidence: {
              ...metric.provenance.evidence,
              ...(params.document.file_type === 'xlsx'
                ? { sourceSheet: sheet.name }
                : {}),
            },
          },
        },
        extractorVersion
      )
    )
  })

  return deduplicateCandidates(candidates)
}

export function getDocumentExtractorVersion(fileType: Document['file_type']) {
  return EXTRACTOR_VERSIONS[fileType]
}
