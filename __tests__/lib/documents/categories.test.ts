import {
  classifyDocumentCategory,
  normalizeDocumentCategory,
} from '@/lib/documents/categories'

describe('document categories', () => {
  it('uses safe legacy fallbacks based on file format', () => {
    expect(normalizeDocumentCategory(null, 'csv')).toBe('data_export')
    expect(normalizeDocumentCategory('legacy-report', 'pdf')).toBe('other')
  })

  it('classifies common finance documents without a model call', () => {
    expect(classifyDocumentCategory({
      fileType: 'pdf',
      fileName: 'monthly-bank-statement.pdf',
    })).toBe('bank_statement')
    expect(classifyDocumentCategory({
      fileType: 'pdf',
      fileName: 'report.pdf',
      text: 'Statement of financial position',
    })).toBe('financial_statement')
    expect(classifyDocumentCategory({
      fileType: 'xlsx',
      fileName: 'anything.xlsx',
    })).toBe('data_export')
  })
})
