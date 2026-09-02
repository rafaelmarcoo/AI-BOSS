import { ApiError } from '@/lib/api/errors'
import {
  readOptionalConversationId,
  validateDocumentUpload,
} from '@/lib/documents/validation'

describe('document upload validation', () => {
  it('accepts a pdf file upload', () => {
    const file = new File(['hello'], 'report.pdf', {
      type: 'application/pdf',
    })

    expect(validateDocumentUpload(file)).toMatchObject({
      file,
      fileType: 'pdf',
    })
  })

  it('accepts a csv file upload by extension', () => {
    const file = new File(['name,value'], 'forecast.csv', {
      type: 'application/octet-stream',
    })

    expect(validateDocumentUpload(file)).toMatchObject({
      file,
      fileType: 'csv',
    })
  })

  it('accepts an xlsx file upload', () => {
    const file = new File(['workbook'], 'forecast.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    expect(validateDocumentUpload(file)).toMatchObject({
      file,
      fileType: 'xlsx',
    })
  })

  it('does not treat legacy xls files as csv based on a broad MIME type', () => {
    const file = new File(['legacy'], 'forecast.xls', {
      type: 'application/vnd.ms-excel',
    })

    expect(() => validateDocumentUpload(file)).toThrow(ApiError)
  })

  it('rejects unsupported uploads', () => {
    const file = new File(['hello'], 'notes.txt', {
      type: 'text/plain',
    })

    expect(() => validateDocumentUpload(file)).toThrow(ApiError)
    expect(() => validateDocumentUpload(file)).toThrow(
      'Only PDF, CSV, and XLSX uploads are supported.'
    )
  })

  it('rejects empty and oversized supported files', () => {
    const empty = new File([], 'empty.csv', { type: 'text/csv' })
    const oversized = new File(['x'], 'too-large.pdf', {
      type: 'application/pdf',
    })
    Object.defineProperty(oversized, 'size', { value: 15 * 1024 * 1024 + 1 })

    expect(() => validateDocumentUpload(empty)).toThrow('Uploaded file is empty.')
    expect(() => validateDocumentUpload(oversized)).toThrow(
      'Uploaded file exceeds the 15 MB size limit.'
    )
  })

  it('reads an optional conversation id', () => {
    expect(readOptionalConversationId(' conversation-123 ')).toBe(
      'conversation-123'
    )
    expect(readOptionalConversationId('   ')).toBeNull()
    expect(readOptionalConversationId(null)).toBeNull()
  })
})
