type CategorisableFileType = 'pdf' | 'csv' | 'xlsx' | 'image' | 'text' | 'docx'

export const DOCUMENT_CATEGORIES = [
  'invoice_receipt',
  'financial_statement',
  'bank_statement',
  'budget_forecast',
  'data_export',
  'other',
] as const

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  invoice_receipt: 'Invoices & receipts',
  financial_statement: 'Financial statements',
  bank_statement: 'Bank statements',
  budget_forecast: 'Budgets & forecasts',
  data_export: 'Data exports',
  other: 'Other',
}

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return (
    typeof value === 'string' &&
    DOCUMENT_CATEGORIES.includes(value as DocumentCategory)
  )
}

export function normalizeDocumentCategory(
  value: unknown,
  fileType?: CategorisableFileType
): DocumentCategory {
  if (isDocumentCategory(value)) return value
  return fileType === 'csv' || fileType === 'xlsx' ? 'data_export' : 'other'
}

export function classifyDocumentCategory(params: {
  fileType: CategorisableFileType
  fileName: string
  text?: string | null
}): DocumentCategory {
  if (params.fileType === 'csv' || params.fileType === 'xlsx') {
    return 'data_export'
  }

  const evidence = `${params.fileName}\n${params.text ?? ''}`
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
  if (/\b(bank statement|transaction statement|account statement)\b/.test(evidence)) {
    return 'bank_statement'
  }
  if (/\b(invoice|receipt|tax invoice|balance due)\b/.test(evidence)) {
    return 'invoice_receipt'
  }
  if (/\b(budget|forecast|projection|projected)\b/.test(evidence)) {
    return 'budget_forecast'
  }
  if (
    /\b(financial statement|balance sheet|profit and loss|income statement|cash flow statement|statement of financial position)\b/.test(
      evidence
    )
  ) {
    return 'financial_statement'
  }
  return 'other'
}
