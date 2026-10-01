import { join } from 'node:path'

import { ApiError } from '@/lib/api/errors'
import {
  createCsvChunks,
  createImageChunks,
  createPdfChunks,
} from '@/lib/documents/chunking'
import { extractImageMetrics, extractImageText } from '@/lib/documents/image-extraction'
import type { ExtractedItem, ItemAttributes } from '@/lib/financial-data/attributes'
import type {
  ParsedCsvRow,
  ParsedDocumentResult,
  ParsedPdfPage,
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

// pdfjs-dist's "legacy" build still references browser-only globals
// (DOMMatrix, Path2D, ImageData) even for text-only extraction with no
// rendering — they're missing in a plain Node.js/serverless runtime, which
// surfaces as "DOMMatrix is not defined" the first time a PDF is parsed.
// @napi-rs/canvas ships real implementations of these; only needs doing once
// per warm process.
async function ensurePdfCanvasPolyfills() {
  if (typeof (globalThis as Record<string, unknown>).DOMMatrix !== 'undefined') {
    return
  }

  const { DOMMatrix, Path2D, ImageData, DOMRect } = await import('@napi-rs/canvas')
  Object.assign(globalThis, { DOMMatrix, Path2D, ImageData, DOMRect })
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

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }

      continue
    }

    if (character === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += character
  }

  cells.push(current)

  return cells.map((cell) => cell.trim())
}

function parseCsvContent(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]
    const nextCharacter = normalized[index + 1]

    if (character === '"') {
      current += character

      if (inQuotes && nextCharacter === '"') {
        current += nextCharacter
        index += 1
      } else {
        inQuotes = !inQuotes
      }

      continue
    }

    if (character === '\n' && !inQuotes) {
      rows.push(parseCsvLine(current))
      current = ''
      continue
    }

    current += character
  }

  if (current || normalized.endsWith('\n')) {
    rows.push(parseCsvLine(current))
  }

  return rows.filter((row) => row.some((cell) => cell.length > 0))
}

function normalizeHeaders(headers: string[]) {
  return headers.map((header, index) => header || `column_${index + 1}`)
}

function normalizeHeaderText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function rowHasHeaderCandidate(row: string[], candidates: string[]) {
  const normalizedCells = row.map(normalizeHeaderText)

  return candidates.some((candidate) =>
    normalizedCells.includes(normalizeHeaderText(candidate))
  )
}

function findCsvHeaderRowIndex(rows: string[][]) {
  const labelHeaderCandidates = [
    'metric',
    'name',
    'label',
    'account',
    'account name',
    'description',
    'category',
  ]
  const amountHeaderCandidates = [
    'value',
    'amount',
    'balance',
    'total',
    'closing balance',
  ]

  const detectedHeaderIndex = rows.findIndex(
    (row) =>
      rowHasHeaderCandidate(row, labelHeaderCandidates) &&
      rowHasHeaderCandidate(row, amountHeaderCandidates)
  )

  return detectedHeaderIndex >= 0 ? detectedHeaderIndex : 0
}

function createCsvRowBlock(
  headers: string[],
  row: string[],
  rowNumber: number
) {
  const pairs = headers.map((header, index) => {
    const value = row[index]?.trim() ?? ''
    return `${header}: ${value || '(empty)'}`
  })

  return `Row ${rowNumber}\n${pairs.join('\n')}`
}

function createStructuredCsvRows(
  headers: string[],
  rows: string[][]
): ParsedCsvRow[] {
  return rows.map((row, index) => ({
    rowNumber: index + 1,
    values: row,
    cells: headers.reduce<Record<string, string>>((cells, header, cellIndex) => {
      cells[header] = row[cellIndex]?.trim() ?? ''
      return cells
    }, {}),
  }))
}

export async function parseDocumentContent(
  document: Pick<
    Document,
    'id' | 'user_id' | 'file_type' | 'file_name' | 'mime_type'
  >,
  fileBytes: Uint8Array
): Promise<ParsedDocumentResult> {
  if (document.file_type === 'csv') {
    return parseCsvDocument(document, fileBytes)
  }

  if (document.file_type === 'pdf') {
    return parsePdfDocument(document, fileBytes)
  }

  if (document.file_type === 'image') {
    return parseImageDocument(document, fileBytes)
  }

  if (document.file_type === 'xlsx') {
    return parseXlsxDocument(document, fileBytes)
  }

  if (document.file_type === 'text') {
    return parseTextDocument(document, fileBytes)
  }

  if (document.file_type === 'docx') {
    return parseDocxDocument(document, fileBytes)
  }

  throw new ApiError(400, 'BAD_REQUEST', 'Unsupported document type.')
}

async function parseImageDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_name' | 'mime_type'>,
  fileBytes: Uint8Array
) {
  try {
    const text = normalizeWhitespace(
      await extractImageText(fileBytes, document.mime_type)
    )

    if (!text) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `No readable content was found in ${document.file_name}.`
      )
    }

    let extractedMetrics: Record<string, number> = {}
    let extractedMetricIssues: Array<{ label: string; rawValue: string }> = []
    let extractedItems: ExtractedItem[] = []
    let extractedMetricAttributes: Record<string, ItemAttributes> = {}

    try {
      const result = await extractImageMetrics(fileBytes, document.mime_type, {
        documentId: document.id,
        sourceLabel: document.file_name,
        extractedAt: new Date().toISOString(),
      })
      // Canonical fixed metrics (result.metrics) are not written to
      // financial_metric_observations from this branch — see the note in
      // image-extraction.ts. Only the free-form label -> number map goes into
      // the document's displayed metadata, same as before this change.
      extractedMetrics = result.customMetrics
      extractedMetricIssues = result.issues
      extractedItems = result.items
      extractedMetricAttributes = result.itemAttributes
    } catch (metricsError) {
      console.error(
        `Failed to extract structured metrics from ${document.file_name}.`,
        metricsError
      )
    }

    const metadata: Record<string, unknown> = {}

    if (Object.keys(extractedMetrics).length > 0) {
      metadata.extractedMetrics = extractedMetrics
    }

    if (extractedMetricIssues.length > 0) {
      metadata.extractedMetricIssues = extractedMetricIssues
    }

    if (extractedItems.length > 0) {
      metadata.extractedItems = extractedItems
    }

    if (Object.keys(extractedMetricAttributes).length > 0) {
      metadata.extractedMetricAttributes = extractedMetricAttributes
    }

    return {
      rawText: text,
      metadata,
      chunks: createImageChunks({
        documentId: document.id,
        userId: document.user_id,
        text,
      }),
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    console.error(`Failed to parse image ${document.file_name}.`, error)

    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Failed to parse image ${document.file_name}.`
    )
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
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `No readable text was found in ${document.file_name}.`
      )
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
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    console.error(`Failed to parse PDF ${document.file_name}.`, error)

    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Failed to parse PDF ${document.file_name}.`
    )
  } finally {
    await loadingTask.destroy()
  }
}

// Plain text has no columns to key off (unlike CSV/XLSX) and no PDF binary
// to decode — but once decoded, it's free-form "label: value" lines exactly
// like a PDF's extracted text, so this reuses the same page-based extraction
// and chunking, treating the whole file as a single page.
// Shared by anything that boils down to "one blob of free-form text" — plain
// text files use their raw content directly, DOCX converts to text via
// mammoth first, but from here on both are treated as a single PDF-style
// page so they share the same chunking and line-matching logic.
function buildTextAsSinglePageResult(
  document: Pick<Document, 'id' | 'user_id' | 'file_name'>,
  decoded: string
) {
  if (!decoded) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `No readable text was found in ${document.file_name}.`
    )
  }

  const lines = decoded.split('\n')
  const pages: ParsedPdfPage[] = [{ pageNumber: 1, text: decoded, lines }]

  return {
    rawText: decoded,
    metadata: {},
    chunks: createPdfChunks({
      documentId: document.id,
      userId: document.user_id,
      pages,
    }),
    pdfPages: pages,
  }
}

function parseTextDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_name'>,
  fileBytes: Uint8Array
) {
  try {
    const decoded = normalizeWhitespace(Buffer.from(fileBytes).toString('utf8'))

    return buildTextAsSinglePageResult(document, decoded)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    console.error(`Failed to parse text file ${document.file_name}.`, error)

    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Failed to parse text file ${document.file_name}.`
    )
  }
}

function stripHtmlTags(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

// mammoth's plain-text mode puts each table cell on its own line (so "Revenue"
// and "10000" end up as two separate lines, never "Revenue: 10000" together),
// which the label/value line-matching below can never recognize. Converting to
// HTML instead preserves <table><tr><td> structure, letting each row become one
// reconstructed "label: value" line — everything outside tables still becomes
// one line per paragraph, same as before.
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
    const result = await mammoth.convertToHtml({
      buffer: Buffer.from(fileBytes),
    })
    const decoded = normalizeWhitespace(mammothHtmlToLines(result.value).join('\n'))

    return buildTextAsSinglePageResult(document, decoded)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    console.error(`Failed to parse DOCX ${document.file_name}.`, error)

    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Failed to parse DOCX ${document.file_name}.`
    )
  }
}

// Shared by anything that boils down to a grid of rows/columns — CSV text
// parses directly into this shape, and XLSX sheets convert into the same
// shape, so both can reuse identical header-detection/chunking logic.
function buildTabularDocumentResult(
  document: Pick<Document, 'id' | 'user_id' | 'file_name'>,
  rows: string[][],
  formatLabel: string
) {
  if (rows.length === 0) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `No rows were found in ${document.file_name}.`
    )
  }

  const headerRowIndex = findCsvHeaderRowIndex(rows)
  const headers = normalizeHeaders(rows[headerRowIndex] ?? [])
  const dataRows = rows.slice(headerRowIndex + 1)

  if (dataRows.length === 0) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `${formatLabel} ${document.file_name} must include at least one data row.`
    )
  }

  const rowBlocks = dataRows.map((row, index) =>
    createCsvRowBlock(headers, row, index + 1)
  )
  const structuredRows = createStructuredCsvRows(headers, dataRows)
  const rawText = [
    `Columns: ${headers.join(', ')}`,
    ...rowBlocks,
  ].join('\n\n')

  return {
    rawText,
    metadata: {
      headers,
      rowCount: dataRows.length,
      skippedRowCount: headerRowIndex,
    },
    csvData: {
      headers,
      rows: structuredRows,
    },
    chunks: createCsvChunks({
      documentId: document.id,
      userId: document.user_id,
      rowBlocks,
      headers,
    }),
  }
}

function parseCsvDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'>,
  fileBytes: Uint8Array
) {
  try {
    const decoded = normalizeWhitespace(Buffer.from(fileBytes).toString('utf8'))
    const rows = parseCsvContent(decoded)

    return buildTabularDocumentResult(document, rows, 'CSV')
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Failed to parse CSV ${document.file_name}.`
    )
  }
}

async function parseXlsxDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'>,
  fileBytes: Uint8Array
) {
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(fileBytes, { type: 'buffer' })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        `No sheets were found in ${document.file_name}.`
      )
    }

    const sheet = workbook.Sheets[firstSheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    })
    const stringRows = rows.map((row) => row.map((cell) => String(cell ?? '').trim()))

    return buildTabularDocumentResult(document, stringRows, 'Spreadsheet')
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    console.error(`Failed to parse XLSX ${document.file_name}.`, error)

    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Failed to parse spreadsheet ${document.file_name}.`
    )
  }
}
