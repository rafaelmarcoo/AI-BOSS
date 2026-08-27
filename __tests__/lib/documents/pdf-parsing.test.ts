/** @jest-environment node */

import {
  createPdfParsingError,
  parseDocumentContent,
} from '@/lib/documents/parsing'

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  VerbosityLevel: { ERRORS: 0 },
  getDocument: jest.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: jest.fn(async () => ({
        getTextContent: jest.fn(async () => ({ items: [] })),
        cleanup: jest.fn(),
      })),
    }),
    destroy: jest.fn(async () => undefined),
  })),
}))

describe('PDF parsing states', () => {
  it('retains a scanned or image-only PDF as previewable without chunks', async () => {
    const result = await parseDocumentContent(
      {
        id: 'document-1',
        user_id: 'user-1',
        file_type: 'pdf',
        file_name: 'scan.pdf',
      },
      Buffer.from('mock image-only PDF')
    )

    expect(result).toMatchObject({
      rawText: '',
      chunks: [],
      pdfPages: [],
      extractionState: 'scanned',
      metadata: {
        scanned: true,
        extractionAvailable: false,
        warnings: [expect.objectContaining({ code: 'ocr_unavailable' })],
      },
    })
  })

  it('gives password-protected PDFs a specific recoverable failure message', () => {
    const error = new Error('Password required')
    error.name = 'PasswordException'

    expect(createPdfParsingError(error, 'locked.pdf')).toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'PDF locked.pdf is password-protected and cannot be processed.',
    })
  })
})
