import fs from 'node:fs'
import path from 'node:path'

import { extractDocumentCandidates } from '@/lib/documents/extraction-candidates'
import { parseDocumentContent } from '@/lib/documents/parsing'
import {
  parseCsvTabularData,
  parseXlsxTabularData,
} from '@/lib/documents/tabular'
import type { Document } from '@/types/database'

const fixtureDirectory = path.join(
  process.cwd(),
  'demo-assets',
  'document-review-fixtures'
)

function fixtureBytes(name: string) {
  const buffer = fs.readFileSync(path.join(fixtureDirectory, name))
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}

function documentFor(
  fileName: string,
  fileType: Document['file_type']
): Pick<Document, 'id' | 'user_id' | 'file_name' | 'file_type'> {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000002',
    file_name: fileName,
    file_type: fileType,
  }
}

describe('Phase 4 manual document-review fixtures', () => {
  it('keeps the valid CSV monetary and produces three complete months', async () => {
    const document = documentFor('01-valid-nzd-history.csv', 'csv')
    const parsed = await parseDocumentContent(
      document,
      fixtureBytes(document.file_name)
    )
    const candidates = extractDocumentCandidates({
      document,
      parsedDocument: parsed,
      extractedAt: '2026-08-30T00:00:00.000Z',
    })

    expect(candidates).toHaveLength(18)
    expect(candidates.every((candidate) => candidate.currency === 'NZD')).toBe(
      true
    )
    expect(candidates.every((candidate) => candidate.reportingDate)).toBe(true)
  })

  it('keeps direct runway observations currency-free', async () => {
    const document = documentFor('04-runway-unit.csv', 'csv')
    const parsed = await parseDocumentContent(
      document,
      fixtureBytes(document.file_name)
    )
    const candidates = extractDocumentCandidates({
      document,
      parsedDocument: parsed,
      extractedAt: '2026-08-30T00:00:00.000Z',
    })

    expect(candidates.map((candidate) => candidate.metricKey)).toEqual([
      'runway_months',
      'runway_months',
      'runway_months',
    ])
    expect(candidates.map((candidate) => candidate.currency)).toEqual([
      null,
      null,
      null,
    ])
  })

  it('provides deterministic XLSX suggestions and formula-cache evidence', async () => {
    const parsed = await parseXlsxTabularData(
      fixtureBytes('10-multi-sheet-financial-review.xlsx')
    )

    expect(parsed.suggestedSheetNames).toEqual([
      'Cash Flow',
      'Summary',
      'AUD Detail',
    ])
    expect(parsed.worksheetMetadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Archive',
          visibility: 'hidden',
          suggested: false,
          empty: true,
        }),
        expect.objectContaining({ name: 'Notes', empty: true }),
      ])
    )
    expect(parsed.warnings).toEqual([
      expect.objectContaining({
        code: 'formula_result_missing',
        sheetName: 'Cash Flow',
        rowNumber: 7,
        columnNumber: 2,
      }),
    ])

    const summary = parsed.sheets.find((sheet) => sheet.name === 'Summary')
    expect(summary?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cells: expect.objectContaining({
            Metric: 'Cash burn',
            Amount: '15000',
          }),
        }),
        expect.objectContaining({
          cells: expect.objectContaining({
            Metric: 'Runway months',
            Currency: '',
          }),
        }),
      ])
    )
  })

  it('contains valid PDF containers for text, scanned, and locked testing', () => {
    for (const fileName of [
      '11-text-financial-statement.pdf',
      '12-scanned-financial-statement.pdf',
      '13-locked-financial-statement.pdf',
    ]) {
      expect(fixtureBytes(fileName).subarray(0, 4)).toEqual(
        new Uint8Array(Buffer.from('%PDF'))
      )
    }
  })

  it('contains the intended preview and empty-upload boundaries', () => {
    const wide = parseCsvTabularData(fixtureBytes('16-wide-55-columns.csv'))
    expect(wide.sheets[0].headers).toHaveLength(55)
    expect(wide.sheets[0].rows).toHaveLength(120)

    expect(fs.statSync(path.join(fixtureDirectory, '09-empty.csv')).size).toBe(0)
  })
})
