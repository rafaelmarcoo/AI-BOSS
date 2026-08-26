import { join } from 'node:path'

import { ApiError } from '@/lib/api/errors'
import { createPdfChunks, createTabularChunks } from '@/lib/documents/chunking'
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
  document: Pick<Document, 'id' | 'user_id' | 'file_type' | 'file_name'>,
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
