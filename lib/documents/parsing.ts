import { join } from 'node:path'

import { ApiError } from '@/lib/api/errors'
import { createCsvChunks, createPdfChunks } from '@/lib/documents/chunking'
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

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
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
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'>,
  fileBytes: Uint8Array
): Promise<ParsedDocumentResult> {
  if (document.file_type === 'csv') {
    return parseCsvDocument(document, fileBytes)
  }

  if (document.file_type === 'pdf') {
    return parsePdfDocument(document, fileBytes)
  }

  throw new ApiError(400, 'BAD_REQUEST', 'Unsupported document type.')
}

async function parsePdfDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'>,
  fileBytes: Uint8Array
) {
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
      const text = normalizeWhitespace(
        textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .filter(Boolean)
          .join(' ')
      )

      if (text) {
        pages.push({
          pageNumber,
          text,
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

function parseCsvDocument(
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'>,
  fileBytes: Uint8Array
) {
  try {
    const decoded = normalizeWhitespace(Buffer.from(fileBytes).toString('utf8'))
    const rows = parseCsvContent(decoded)

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
        `CSV ${document.file_name} must include at least one data row.`
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
