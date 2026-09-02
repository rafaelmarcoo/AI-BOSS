import ExcelJS from 'exceljs'

import { ApiError } from '@/lib/api/errors'
import { parseDocumentContent } from '@/lib/documents/parsing'
import {
  parseCsvTabularData,
  parseXlsxTabularData,
} from '@/lib/documents/tabular'

async function workbookBytes(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

describe('shared tabular parsing', () => {
  it('detects delimiter and Windows-1252 text while preserving source rows', () => {
    const prefix = Buffer.from('Account;Amount;Currency;Date\r\nCaf')
    const suffix = Buffer.from(';1200;NZD;2026-08-01')
    const bytes = Buffer.concat([prefix, Buffer.from([0xe9]), suffix])

    const result = parseCsvTabularData(bytes)
    const sheet = result.sheets[0]

    expect(sheet.headers).toEqual(['Account', 'Amount', 'Currency', 'Date'])
    expect(sheet.rows[0]).toMatchObject({
      rowNumber: 2,
      cells: {
        Account: 'Café',
        Amount: '1200',
        Currency: 'NZD',
        Date: '2026-08-01',
      },
    })
  })

  it('suggests likely visible financial sheets and supports multiple selections', async () => {
    const workbook = new ExcelJS.Workbook()
    const notes = workbook.addWorksheet('Notes')
    notes.addRow(['Comment'])
    notes.addRow(['Board pack'])

    const financial = workbook.addWorksheet('Financial Summary')
    financial.mergeCells('A1:D1')
    financial.getCell('A1').value = 'Monthly management report'
    financial.addRow(['Account', 'Amount', 'Currency', 'Date'])
    financial.addRow(['Cash at bank', 125000, 'NZD', new Date('2026-07-31T00:00:00Z')])
    financial.getCell('B4').value = { formula: 'B3*2', result: 250000 }
    financial.getCell('A4').value = 'Revenue'
    financial.getCell('C4').value = 'NZD'
    financial.getCell('D4').value = new Date('2026-07-31T00:00:00Z')
    financial.getCell('B5').value = { formula: 'B3*3' }
    financial.getCell('A5').value = 'Forecast without cache'

    const archive = workbook.addWorksheet('Archive')
    archive.state = 'hidden'
    archive.addRow(['Metric', 'Value', 'Currency', 'Date'])
    archive.addRow(['Cash', 90000, 'AUD', new Date('2025-07-31T00:00:00Z')])

    const bytes = await workbookBytes(workbook)
    const suggested = await parseXlsxTabularData(bytes)

    expect(suggested.suggestedSheetNames).toEqual(['Financial Summary'])
    expect(suggested.selectedSheetNames).toEqual(['Financial Summary'])
    expect(suggested.worksheetMetadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Archive',
          visibility: 'hidden',
          suggested: false,
        }),
      ])
    )
    expect(suggested.sheets[0].rows[0].cells).toMatchObject({
      Account: 'Cash at bank',
      Amount: '125000',
      Currency: 'NZD',
      Date: '2026-07-31',
    })
    expect(suggested.sheets[0].rows[1].cells.Amount).toBe('250000')
    expect(suggested.sheets[0].rows[2].cells.Amount).toBe('')
    expect(suggested.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'formula_result_missing',
          sheetName: 'Financial Summary',
          rowNumber: 5,
          columnNumber: 2,
        }),
      ])
    )

    const multiSheet = await parseXlsxTabularData(bytes, [
      'Financial Summary',
      'Archive',
    ])
    expect(multiSheet.selectedSheetNames).toEqual([
      'Financial Summary',
      'Archive',
    ])
    expect(multiSheet.sheets).toHaveLength(2)
  })

  it('creates sheet-aware XLSX retrieval chunks', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Cash Forecast')
    worksheet.addRow(['Metric', 'Amount', 'Currency', 'Date'])
    worksheet.addRow(['Cash', 100000, 'NZD', new Date('2026-08-01T00:00:00Z')])

    const result = await parseDocumentContent(
      {
        id: 'document-1',
        user_id: 'user-1',
        file_type: 'xlsx',
        file_name: 'forecast.xlsx',
      },
      await workbookBytes(workbook)
    )

    expect(result.tabularData?.sourceType).toBe('xlsx')
    expect(result.rawText).toContain('Worksheet: Cash Forecast')
    expect(result.chunks[0].metadata).toMatchObject({
      source: 'xlsx',
      sheetName: 'Cash Forecast',
      rowStart: 2,
      rowEnd: 2,
    })
  })

  it('rejects corrupt workbooks and unknown worksheet selections', async () => {
    await expect(parseXlsxTabularData(Buffer.from('not a workbook'))).rejects.toThrow(
      'corrupt, password-protected, or unreadable'
    )

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Financials')
    worksheet.addRow(['Metric', 'Amount'])
    worksheet.addRow(['Cash', 1])
    const bytes = await workbookBytes(workbook)

    await expect(parseXlsxTabularData(bytes, ['Missing'])).rejects.toBeInstanceOf(
      ApiError
    )
  })

  it('rejects selected sheets wider than 200 columns', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Wide Financials')
    worksheet.addRow(Array.from({ length: 201 }, (_, index) => `Column ${index + 1}`))
    worksheet.addRow(Array.from({ length: 201 }, () => 1))

    await expect(
      parseXlsxTabularData(await workbookBytes(workbook))
    ).rejects.toThrow('the limit is 200')
  })

  it('rejects workbooks with more than 25 worksheets', async () => {
    const workbook = new ExcelJS.Workbook()
    for (let index = 1; index <= 26; index += 1) {
      const worksheet = workbook.addWorksheet(`Sheet ${index}`)
      worksheet.addRow(['Metric', 'Amount'])
      worksheet.addRow(['Cash', index])
    }

    await expect(parseXlsxTabularData(await workbookBytes(workbook))).rejects.toThrow(
      'the limit is 25'
    )
  })

  it('rejects CSV input above 50,000 selected non-empty rows', () => {
    const rows = ['Metric,Amount']
    for (let index = 0; index < 50_000; index += 1) {
      rows.push(`Cash,${index}`)
    }

    expect(() => parseCsvTabularData(Buffer.from(rows.join('\n')))).toThrow(
      'the limit is 50000'
    )
  })
})
