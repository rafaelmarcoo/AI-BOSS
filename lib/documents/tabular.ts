import ExcelJS, { type Cell, type Worksheet } from 'exceljs'

import { ApiError } from '@/lib/api/errors'
import {
  MAX_SELECTED_TABULAR_ROWS,
  MAX_TABULAR_COLUMNS,
  MAX_XLSX_WORKSHEETS,
} from '@/lib/documents/constants'
import type {
  ParsedCsvRow,
  ParsedTabularData,
  ParsedTabularSheet,
  TabularSheetMetadata,
  TabularWarning,
} from '@/lib/documents/types'

interface SourceRow {
  rowNumber: number
  values: string[]
}

const DELIMITER_CANDIDATES = [',', '\t', ';', '|'] as const
const LABEL_HEADERS = [
  'metric',
  'name',
  'label',
  'account',
  'account name',
  'description',
  'category',
]
const AMOUNT_HEADERS = [
  'value',
  'amount',
  'balance',
  'total',
  'closing balance',
]
const DATE_HEADERS = ['date', 'as of', 'as_of_date', 'period', 'period end']
const CURRENCY_HEADERS = ['currency', 'ccy']
const FINANCIAL_SHEET_NAME_PATTERN =
  /\b(financial|statement|balance|cash|profit|loss|p&l|revenue|expense|budget|forecast)\b/i

function normalizeHeaderText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesHeader(row: string[], candidates: string[]) {
  const values = new Set(row.map(normalizeHeaderText))
  return candidates.some((candidate) => values.has(normalizeHeaderText(candidate)))
}

function findHeaderRowIndex(rows: SourceRow[]) {
  const detected = rows.findIndex(
    (row) =>
      includesHeader(row.values, LABEL_HEADERS) &&
      includesHeader(row.values, AMOUNT_HEADERS)
  )

  return detected >= 0 ? detected : 0
}

function normalizeHeaders(headers: string[]) {
  const counts = new Map<string, number>()

  return headers.map((header, index) => {
    const base = header.trim() || `column_${index + 1}`
    const count = (counts.get(base) ?? 0) + 1
    counts.set(base, count)
    return count === 1 ? base : `${base}_${count}`
  })
}

function trimTrailingEmptyCells(values: string[]) {
  const trimmed = [...values]

  while (trimmed.length > 0 && !trimmed.at(-1)?.trim()) {
    trimmed.pop()
  }

  return trimmed
}

function createStructuredRows(headers: string[], rows: SourceRow[]): ParsedCsvRow[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    values: headers.map((_, index) => row.values[index]?.trim() ?? ''),
    cells: headers.reduce<Record<string, string>>((cells, header, index) => {
      cells[header] = row.values[index]?.trim() ?? ''
      return cells
    }, {}),
  }))
}

function buildSheet(params: {
  name: string
  visibility: ParsedTabularSheet['visibility']
  rows: SourceRow[]
  warnings?: TabularWarning[]
}) {
  const nonEmptyRows = params.rows
    .map((row) => ({ ...row, values: trimTrailingEmptyCells(row.values) }))
    .filter((row) => row.values.some((value) => value.trim()))
  const columnCount = Math.max(0, ...nonEmptyRows.map((row) => row.values.length))

  if (columnCount > MAX_TABULAR_COLUMNS) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `${params.name} contains ${columnCount} columns; the limit is ${MAX_TABULAR_COLUMNS}.`
    )
  }

  if (nonEmptyRows.length === 0) {
    return {
      name: params.name,
      visibility: params.visibility,
      headers: [],
      rows: [],
      headerRowNumber: 0,
      nonEmptyRowCount: 0,
      columnCount: 0,
      warnings: params.warnings ?? [],
    } satisfies ParsedTabularSheet
  }

  const headerIndex = findHeaderRowIndex(nonEmptyRows)
  const headerRow = nonEmptyRows[headerIndex]
  const headers = normalizeHeaders(headerRow.values)
  const dataRows = nonEmptyRows.slice(headerIndex + 1)

  return {
    name: params.name,
    visibility: params.visibility,
    headers,
    rows: createStructuredRows(headers, dataRows),
    headerRowNumber: headerRow.rowNumber,
    nonEmptyRowCount: nonEmptyRows.length,
    columnCount,
    warnings: params.warnings ?? [],
  } satisfies ParsedTabularSheet
}

function countDelimiter(value: string, delimiter: string) {
  let count = 0
  let quoted = false

  for (const character of value) {
    if (character === '"') quoted = !quoted
    if (!quoted && character === delimiter) count += 1
  }

  return count
}

function detectDelimiter(value: string) {
  const sample = value.split(/\r?\n/).slice(0, 20).join('\n')
  return DELIMITER_CANDIDATES.reduce((best, candidate) =>
    countDelimiter(sample, candidate) > countDelimiter(sample, best)
      ? candidate
      : best
  )
}

function parseDelimitedRows(value: string, delimiter: string) {
  const rows: SourceRow[] = []
  let cells: string[] = []
  let current = ''
  let quoted = false
  let physicalRow = 1
  let rowStart = 1

  const pushRow = () => {
    cells.push(current.trim())
    rows.push({ rowNumber: rowStart, values: cells })
    cells = []
    current = ''
  }

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    const next = value[index + 1]

    if (character === '"') {
      if (quoted && next === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (character === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      pushRow()
      physicalRow += 1
      rowStart = physicalRow
      continue
    }

    if (character === '\n') physicalRow += 1
    current += character
  }

  if (current || cells.length > 0) pushRow()
  return rows
}

function decodeDelimitedText(fileBytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(fileBytes)
  } catch {
    return new TextDecoder('windows-1252').decode(fileBytes)
  }
}

function suggestionScore(sheet: ParsedTabularSheet) {
  if (sheet.nonEmptyRowCount === 0 || sheet.visibility !== 'visible') return -1

  let score = FINANCIAL_SHEET_NAME_PATTERN.test(sheet.name) ? 3 : 0
  if (includesHeader(sheet.headers, LABEL_HEADERS)) score += 2
  if (includesHeader(sheet.headers, AMOUNT_HEADERS)) score += 2
  if (includesHeader(sheet.headers, DATE_HEADERS)) score += 1
  if (includesHeader(sheet.headers, CURRENCY_HEADERS)) score += 1
  return score
}

function suggestSheets(sheets: ParsedTabularSheet[]) {
  const scored = sheets
    .map((sheet) => ({ name: sheet.name, score: suggestionScore(sheet) }))
    .filter((sheet) => sheet.score >= 4)
    .sort((left, right) => right.score - left.score)

  if (scored.length > 0) return scored.map((sheet) => sheet.name)
  const fallback = sheets.find(
    (sheet) => sheet.visibility === 'visible' && sheet.nonEmptyRowCount > 0
  )
  return fallback ? [fallback.name] : []
}

function sheetMetadata(
  sheets: ParsedTabularSheet[],
  suggestedSheetNames: string[]
): TabularSheetMetadata[] {
  const suggestions = new Set(suggestedSheetNames)
  return sheets.map((sheet) => ({
    name: sheet.name,
    visibility: sheet.visibility,
    nonEmptyRowCount: sheet.nonEmptyRowCount,
    columnCount: sheet.columnCount,
    suggested: suggestions.has(sheet.name),
    empty: sheet.nonEmptyRowCount === 0,
  }))
}

function selectSheets(
  sheets: ParsedTabularSheet[],
  suggestedSheetNames: string[],
  selectedWorksheetNames?: string[]
) {
  const requested = selectedWorksheetNames
    ? [...new Set(selectedWorksheetNames.map((name) => name.trim()).filter(Boolean))]
    : suggestedSheetNames
  const sheetNames = new Set(sheets.map((sheet) => sheet.name))
  const unknown = requested.filter((name) => !sheetNames.has(name))

  if (unknown.length > 0) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `Unknown worksheet selection: ${unknown.join(', ')}.`
    )
  }

  const selected = sheets.filter((sheet) => requested.includes(sheet.name))
  const selectedNonEmptyRows = selected.reduce(
    (total, sheet) => total + sheet.nonEmptyRowCount,
    0
  )

  if (selectedNonEmptyRows > MAX_SELECTED_TABULAR_ROWS) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `Selected worksheets contain ${selectedNonEmptyRows} non-empty rows; the limit is ${MAX_SELECTED_TABULAR_ROWS}.`
    )
  }

  if (selected.length === 0 || selected.every((sheet) => sheet.rows.length === 0)) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'Select at least one worksheet containing a header and data rows.'
    )
  }

  return { selected, selectedSheetNames: requested }
}

function worksheetVisibility(
  state: Worksheet['state']
): ParsedTabularSheet['visibility'] {
  if (state === 'hidden') return 'hidden'
  if (state === 'veryHidden') return 'veryHidden'
  return 'visible'
}

function isFormulaValue(value: ExcelJS.CellValue): value is ExcelJS.CellFormulaValue {
  return Boolean(
    value &&
      typeof value === 'object' &&
      ('formula' in value || 'sharedFormula' in value)
  )
}

function excelSerialToIsoDate(value: number, date1904: boolean) {
  const epoch = date1904
    ? Date.UTC(1904, 0, 1)
    : Date.UTC(1899, 11, 30)
  return new Date(epoch + value * 86_400_000).toISOString().slice(0, 10)
}

function isDateNumberFormat(numberFormat = '') {
  const withoutLiterals = numberFormat.replace(/"[^"]*"/g, '')
  return /(^|[^a-z])[dmy]{1,4}([^a-z]|$)/i.test(withoutLiterals)
}

function cellValueToString(params: {
  cell: Cell
  value: ExcelJS.CellValue
  date1904: boolean
  warnings: TabularWarning[]
  sheetName: string
}) {
  const { cell, value } = params

  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)

  if (isFormulaValue(value)) {
    if (value.result === null || value.result === undefined) {
      params.warnings.push({
        code: 'formula_result_missing',
        message: 'Formula cell was excluded because it has no cached result.',
        sheetName: params.sheetName,
        rowNumber: Number(cell.row),
        columnNumber: Number(cell.col),
      })
      return ''
    }

    return cellValueToString({ ...params, value: value.result })
  }

  if (typeof value === 'number') {
    if (isDateNumberFormat(cell.numFmt)) {
      return excelSerialToIsoDate(value, params.date1904)
    }
    if (cell.numFmt?.includes('%')) return `${value * 100}%`
    return String(value)
  }

  if (typeof value === 'string' || typeof value === 'boolean') return String(value)
  if ('richText' in value) return value.richText.map((part) => part.text).join('')
  if ('text' in value) return value.text
  if ('error' in value) return ''
  return String(value)
}

function readWorksheet(
  worksheet: Worksheet,
  date1904: boolean
): ParsedTabularSheet {
  const warnings: TabularWarning[] = []
  const rows: SourceRow[] = []

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: string[] = []
    const lastColumn = Math.min(row.cellCount, MAX_TABULAR_COLUMNS + 1)

    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column)
      values.push(
        cellValueToString({
          cell,
          value: cell.value,
          date1904,
          warnings,
          sheetName: worksheet.name,
        })
      )
    }

    rows.push({ rowNumber, values })
  })

  return buildSheet({
    name: worksheet.name,
    visibility: worksheetVisibility(worksheet.state),
    rows,
    warnings,
  })
}

export function parseCsvTabularData(fileBytes: Uint8Array): ParsedTabularData {
  const decoded = decodeDelimitedText(fileBytes).replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(decoded)
  const sheet = buildSheet({
    name: 'CSV',
    visibility: 'visible',
    rows: parseDelimitedRows(decoded, delimiter),
  })

  if (sheet.rows.length === 0) {
    throw new ApiError(400, 'BAD_REQUEST', 'CSV must include a header and data row.')
  }

  if (sheet.nonEmptyRowCount > MAX_SELECTED_TABULAR_ROWS) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `CSV contains ${sheet.nonEmptyRowCount} non-empty rows; the limit is ${MAX_SELECTED_TABULAR_ROWS}.`
    )
  }

  return {
    sourceType: 'csv',
    sheets: [sheet],
    selectedSheetNames: ['CSV'],
    suggestedSheetNames: ['CSV'],
    worksheetMetadata: sheetMetadata([sheet], ['CSV']),
    warnings: [],
  }
}

export async function parseXlsxTabularData(
  fileBytes: Uint8Array,
  selectedWorksheetNames?: string[]
): Promise<ParsedTabularData> {
  const workbook = new ExcelJS.Workbook()

  try {
    await workbook.xlsx.load(Uint8Array.from(fileBytes).buffer)
  } catch {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'The XLSX workbook is corrupt, password-protected, or unreadable.'
    )
  }

  if (workbook.worksheets.length === 0) {
    throw new ApiError(400, 'BAD_REQUEST', 'The XLSX workbook has no worksheets.')
  }

  if (workbook.worksheets.length > MAX_XLSX_WORKSHEETS) {
    throw new ApiError(
      400,
      'BAD_REQUEST',
      `The XLSX workbook contains ${workbook.worksheets.length} worksheets; the limit is ${MAX_XLSX_WORKSHEETS}.`
    )
  }

  const sheets = workbook.worksheets.map((worksheet) =>
    readWorksheet(worksheet, Boolean(workbook.properties.date1904))
  )
  const suggestedSheetNames = suggestSheets(sheets)
  const { selected, selectedSheetNames } = selectSheets(
    sheets,
    suggestedSheetNames,
    selectedWorksheetNames
  )
  const warnings = selected.flatMap((sheet) => sheet.warnings)

  return {
    sourceType: 'xlsx',
    sheets: selected,
    selectedSheetNames,
    suggestedSheetNames,
    worksheetMetadata: sheetMetadata(sheets, suggestedSheetNames),
    warnings,
  }
}
