import { ApiError } from '@/lib/api/errors'
import { createCsvChunks, createPdfChunks } from '@/lib/documents/chunking'
import type {
  ParsedDocumentResult,
  ParsedPdfPage,
} from '@/lib/documents/types'
import type { Document } from '@/types/database'

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
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: fileBytes })

  try {
    const [textResult, infoResult] = await Promise.all([
      parser.getText(),
      parser.getInfo({ parsePageInfo: true }),
    ])
    const pages: ParsedPdfPage[] = textResult.pages
      .map((page) => ({
        pageNumber: page.num,
        text: normalizeWhitespace(page.text),
      }))
      .filter((page) => page.text)

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
        pageCount: infoResult.total,
      },
      chunks: createPdfChunks({
        documentId: document.id,
        userId: document.user_id,
        pages,
      }),
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      `Failed to parse PDF ${document.file_name}.`
    )
  } finally {
    await parser.destroy()
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

    const headers = normalizeHeaders(rows[0] ?? [])
    const dataRows = rows.slice(1)

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
    const rawText = [
      `Columns: ${headers.join(', ')}`,
      ...rowBlocks,
    ].join('\n\n')

    return {
      rawText,
      metadata: {
        headers,
        rowCount: dataRows.length,
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
