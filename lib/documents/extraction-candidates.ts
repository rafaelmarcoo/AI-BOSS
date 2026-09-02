import type { ParsedDocumentResult } from '@/lib/documents/types'
import type { DocumentExtractionCandidateDraft } from '@/lib/documents/types'
import { extractCsvFinancialMetrics } from '@/lib/financial-data/extraction/csv'
import { extractPdfFinancialMetrics } from '@/lib/financial-data/extraction/pdf'
import type { AvailableFinancialMetricValue } from '@/lib/financial-data'
import type { Document } from '@/types/database'

const EXTRACTOR_VERSIONS = {
  csv: 'deterministic_csv_v2',
  xlsx: 'deterministic_xlsx_v1',
  pdf: 'deterministic_pdf_v1',
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

export function extractDocumentCandidates(params: {
  document: Pick<Document, 'id' | 'file_name' | 'file_type'>
  parsedDocument: ParsedDocumentResult
  extractedAt: string
}) {
  if (params.document.file_type === 'pdf') {
    const metrics = params.parsedDocument.pdfPages
      ? extractPdfFinancialMetrics({
          pages: params.parsedDocument.pdfPages,
          documentId: params.document.id,
          sourceLabel: params.document.file_name,
          extractedAt: params.extractedAt,
        })
      : []

    return metrics.map((metric) =>
      metricToCandidate(metric, EXTRACTOR_VERSIONS.pdf)
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
