import { join } from 'node:path'

import { ApiError } from '@/lib/api/errors'
import {
  createImageChunks,
  createPdfChunks,
  createTabularChunks,
  createTextChunks,
} from '@/lib/documents/chunking'
import { extractImageDocument } from '@/lib/documents/image-extraction'
import {
  parseCsvTabularData,
  parseXlsxTabularData,
} from '@/lib/documents/tabular'
import type {
  ParseDocumentOptions,
  ParsedDocumentResult,
  ParsedPdfPage,
  ParsedTabularData,
  ParsedTabularSheet,
} from '@/lib/documents/types'
import type { Document } from '@/types/database'

interface PdfDocumentOptions {
  data: Uint8Array
  disableWorker: boolean
  standardFontDataUrl: string
  verbosity: number
}

const PDFJS_STANDARD_FONT_DATA_PATH = `${join(
  process.cwd(),
  'node_modules/pdfjs-dist/standard_fonts'
)}/`

// pdfjs-dist's legacy build still reads these browser globals during module
// initialization. @napi-rs/canvas supplies server-safe implementations for
// Node and Vercel without changing the deterministic text extraction itself.
async function ensurePdfCanvasPolyfills() {
  if (typeof (globalThis as Record<string, unknown>).DOMMatrix !== 'undefined') {
    return
  }

  const { DOMMatrix, Path2D, ImageData, DOMRect } = await import('@napi-rs/canvas')
  Object.assign(globalThis, { DOMMatrix, Path2D, ImageData, DOMRect })
}

export function createPdfParsingError(error: unknown, fileName: string) {
  if (error instanceof Error && error.name === 'PasswordException') {
    return new ApiError(
      400,
      'BAD_REQUEST',
      `PDF ${fileName} is password-protected and cannot be processed.`
    )
  }

  return new ApiError(
    500,
    'INTERNAL_ERROR',
    `Failed to parse PDF ${fileName}.`
  )
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function createPdfTextLines(items: Array<{ str?: string; transform?: number[] }>) {
  const lines: string[] = []
  let currentLine: string[] = []
  let currentY: number | null = null

  for (const item of items) {
    const text = item.str?.trim()
    if (!text) continue

    const y = item.transform?.[5]
    if (
      currentLine.length > 0 &&
      typeof y === 'number' &&
      currentY !== null &&
      Math.abs(y - currentY) > 2
    ) {
      lines.push(currentLine.join(' '))
      currentLine = []
    }

    currentLine.push(text)
    if (typeof y === 'number') currentY = y
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '))
  }

  return lines
}

function createTabularRowBlock(sheet: ParsedTabularSheet, rowIndex: number) {
  const row = sheet.rows[rowIndex]
  const pairs = sheet.headers.map((header, columnIndex) => {
    const value = row.values[columnIndex]?.trim() ?? ''
    return `${header}: ${value || '(empty)'}`
  })

  return `Row ${row.rowNumber}\n${pairs.join('\n')}`
}

function createTabularDocumentResult(params: {
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'>
  tabularData: ParsedTabularData
}): ParsedDocumentResult {
  const rawTextParts: string[] = []
  const chunks: ParsedDocumentResult['chunks'] = []

  for (const sheet of params.tabularData.sheets) {
    const rowBlocks = sheet.rows.map((_, index) =>
      createTabularRowBlock(sheet, index)
    )
    const sheetHeading =
      params.tabularData.sourceType === 'xlsx' ? `Worksheet: ${sheet.name}\n` : ''

    rawTextParts.push(
      `${sheetHeading}Columns: ${sheet.headers.join(', ')}\n\n${rowBlocks.join('\n\n')}`
    )
    chunks.push(
      ...createTabularChunks({
        documentId: params.document.id,
        userId: params.document.user_id,
        rowBlocks,
        rowNumbers: sheet.rows.map((row) => row.rowNumber),
        headers: sheet.headers,
        source: params.tabularData.sourceType,
        sheetName:
          params.tabularData.sourceType === 'xlsx' ? sheet.name : null,
        startingChunkIndex: chunks.length,
      })
    )
  }

  const firstSheet = params.tabularData.sheets[0]
  const commonMetadata = {
    sourceType: params.tabularData.sourceType,
    selectedSheetNames: params.tabularData.selectedSheetNames,
    suggestedSheetNames: params.tabularData.suggestedSheetNames,
    worksheetMetadata: params.tabularData.worksheetMetadata,
    warnings: params.tabularData.warnings,
  }

  return {
    rawText: rawTextParts.join('\n\n'),
    metadata:
      params.tabularData.sourceType === 'csv'
        ? {
            ...commonMetadata,
            headers: firstSheet.headers,
            rowCount: firstSheet.rows.length,
            skippedRowCount: Math.max(0, firstSheet.headerRowNumber - 1),
          }
        : commonMetadata,
    chunks,
    csvData:
      params.tabularData.sourceType === 'csv'
        ? { headers: firstSheet.headers, rows: firstSheet.rows }
        : undefined,
    tabularData: params.tabularData,
  }
}

export async function parseDocumentContent(
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'> &
    Partial<Pick<Document, 'mime_type'>>,
  fileBytes: Uint8Array,
  options: ParseDocumentOptions = {}
): Promise<ParsedDocumentResult> {
  if (document.file_type === 'csv') {
    return createTabularDocumentResult({
      document,
      tabularData: parseCsvTabularData(fileBytes),
    })
  }

  if (document.file_type === 'xlsx') {
    return createTabularDocumentResult({
      document,
      tabularData: await parseXlsxTabularData(
        fileBytes,
        options.selectedWorksheetNames
      ),
    })
  }

  if (document.file_type === 'pdf') {
    return parsePdfDocument(document, fileBytes)
  }

  if (document.file_type === 'image') {
    if (!document.mime_type) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'An image MIME type is required for image extraction.'
      )
    }
    return parseImageDocument(
      { ...document, mime_type: document.mime_type },
      fileBytes
    )
  }

  if (document.file_type === 'text') {
    return parseTextDocument(document, fileBytes)
  }

  if (document.file_type === 'docx') {
    return parseDocxDocument(document, fileBytes)
  }

  throw new ApiError(400, 'BAD_REQUEST', 'Unsupported document type.')
}

function buildTextDocumentResult(
  document: Pick<Document, 'id' | 'user_id' | 'file_name'>,
  decoded: string,
  source: 'text' | 'docx',
  warnings: Array<{ code: string; message: string }> = []
): ParsedDocumentResult {
  const text = normalizeWhitespace(decoded)
  if (!text) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `No readable text was found in ${document.file_name}.`
    )
  }

  const lines = text.split('\n').filter(Boolean)
  return {
    rawText: text,
    metadata: { sourceType: source, warnings },
    chunks: createTextChunks({
      documentId: document.id,
      userId: document.user_id,
      text,
      source,
    }),
    // Reuse the deterministic line-based metric extractor. This is evidence
    // plumbing only; candidates still require the normal human confirmation.
    pdfPages: [{ pageNumber: 1, text, lines }],
    extractionState: 'text',
  }
}

function parseTextDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_name'>,
  fileBytes: Uint8Array
) {
  return buildTextDocumentResult(
    document,
    Buffer.from(fileBytes).toString('utf8'),
    'text'
  )
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function stripHtmlTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function tableHtmlToLines(tableHtml: string) {
  const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []
  return rows
    .map((row) => {
      const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []
      return cells.map(stripHtmlTags).filter(Boolean).join(': ')
    })
    .filter(Boolean)
}

export function mammothHtmlToLines(html: string) {
  const segments = html.split(/(<table[^>]*>[\s\S]*?<\/table>)/gi)
  const lines: string[] = []

  for (const segment of segments) {
    if (/^<table/i.test(segment)) {
      lines.push(...tableHtmlToLines(segment))
      continue
    }

    const paragraphs = segment.match(/<p[^>]*>[\s\S]*?<\/p>/gi) ?? [segment]
    for (const paragraph of paragraphs) {
      const text = stripHtmlTags(paragraph)
      if (text) lines.push(text)
    }
  }

  return lines
}

async function parseDocxDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_name'>,
  fileBytes: Uint8Array
) {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(fileBytes) })
    const warnings = result.messages.map((message) => ({
      code: `docx_${message.type}`,
      message: message.message,
    }))

    return buildTextDocumentResult(
      document,
      mammothHtmlToLines(result.value).join('\n'),
      'docx',
      warnings
    )
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error(`Failed to parse DOCX ${document.file_name}.`, error)
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Failed to parse DOCX ${document.file_name}.`
    )
  }
}

async function parseImageDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_name' | 'mime_type'>,
  fileBytes: Uint8Array
): Promise<ParsedDocumentResult> {
  const extraction = await extractImageDocument(fileBytes, document.mime_type)
  const rawText = normalizeWhitespace(extraction.transcription)

  if (!rawText) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `No readable content was found in ${document.file_name}.`
    )
  }

  return {
    rawText,
    metadata: {
      sourceType: 'image',
      imageExtraction: extraction,
    },
    chunks: createImageChunks({
      documentId: document.id,
      userId: document.user_id,
      text: rawText,
    }),
    imageExtraction: extraction,
  }
}

async function parsePdfDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'>,
  fileBytes: Uint8Array
) {
  await ensurePdfCanvasPolyfills()
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({
    data: fileBytes,
    disableWorker: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_PATH,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  } as PdfDocumentOptions)

  try {
    const pdf = await loadingTask.promise
    const pages: ParsedPdfPage[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const lines = createPdfTextLines(
        textContent.items.map((item) =>
          'str' in item
            ? {
                str: item.str,
                transform: 'transform' in item ? item.transform : undefined,
              }
            : {}
        )
      )
      const text = normalizeWhitespace(
        lines.join('\n')
      )

      if (text) {
        pages.push({
          pageNumber,
          text,
          lines,
        })
      }

      page.cleanup()
    }

    if (pages.length === 0) {
      return {
        rawText: '',
        metadata: {
          pageCount: pdf.numPages,
          scanned: true,
          extractionAvailable: false,
          warnings: [
            {
              code: 'ocr_unavailable',
              message:
                'No readable text was found. The PDF is retained for preview, but OCR extraction is not available.',
            },
          ],
        },
        chunks: [],
        pdfPages: [],
        extractionState: 'scanned',
      } satisfies ParsedDocumentResult
    }

    return {
      rawText: pages.map((page) => page.text).join('\n\n'),
      metadata: {
        pageCount: pdf.numPages,
      },
      chunks: createPdfChunks({
        documentId: document.id,
        userId: document.user_id,
        pages,
      }),
      pdfPages: pages,
      extractionState: 'text',
    } satisfies ParsedDocumentResult
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    const parsingError = createPdfParsingError(error, document.file_name)
    if (parsingError.status >= 500) {
      console.error(`Failed to parse PDF ${document.file_name}.`, error)
    }
    throw parsingError
  } finally {
    await loadingTask.destroy()
  }
}
