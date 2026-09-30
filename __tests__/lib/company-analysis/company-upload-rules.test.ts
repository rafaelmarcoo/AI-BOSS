/** @jest-environment node */

import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { planNewCompany, validateCompanyDetails } from '@/lib/company-analysis/company-details'
import { linesFromStatements, statementsFromCaseStudy, statementsFromLines } from '@/lib/company-analysis/statement-analysis'
import { buildStatementTemplate } from '@/lib/company-analysis/statement-template'
import {
  assertReadyToSave,
  MAX_STATEMENT_UPLOAD_BYTES,
  readStatementFile,
  reviewStatementUpload,
} from '@/lib/company-analysis/statement-upload'
import type { AnalysedCompany } from '@/types/database'

function caseStudy(name: string) {
  return statementsFromCaseStudy(CIMA_CASE_STUDIES.find((candidate) => candidate.name === name)!)
}

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

function company(overrides: Partial<AnalysedCompany>): AnalysedCompany {
  return {
    id: 'company-1',
    user_id: null,
    name: 'Ressett',
    industry: null,
    peer_group: 'lamland-pc-resellers',
    currency: 'L$',
    amounts_in: 'millions',
    description: null,
    source: 'CIMA case study',
    created_at: '2026-09-30T00:00:00.000Z',
    updated_at: '2026-09-30T00:00:00.000Z',
    ...overrides,
  }
}

async function rejection(action: () => unknown) {
  try {
    await action()
  } catch (error) {
    return error as { status: number; code: string; message: string; details?: Record<string, unknown> }
  }
  throw new Error('expected an error')
}

const validFields = { name: 'Kiwi Repairs', currency: 'nzd', amountsIn: 'thousands' }

describe('validateCompanyDetails', () => {
  it('accepts valid details and uppercases the currency', () => {
    expect(validateCompanyDetails(form({ ...validFields, industry: ' PC repairs ', confirmedChecks: 'true' }))).toEqual({
      name: 'Kiwi Repairs',
      industry: 'PC repairs',
      currency: 'NZD',
      amountsIn: 'thousands',
      competitorOf: null,
      confirmedChecks: true,
    })
  })

  it('never assumes a currency', async () => {
    const error = await rejection(() => validateCompanyDetails(form({ name: 'Kiwi Repairs', amountsIn: 'units' })))
    expect(error.status).toBe(400)
    expect(error.details).toHaveProperty('currency')
  })

  it('reports every bad field at once', async () => {
    const error = await rejection(() =>
      validateCompanyDetails(form({ name: 'x'.repeat(121), currency: 'dollars', amountsIn: 'billions' }))
    )
    expect(Object.keys(error.details ?? {}).sort()).toEqual(['amountsIn', 'currency', 'name'])
  })
})

describe('planNewCompany', () => {
  const details = validateCompanyDetails(form(validFields))

  it('starts a new competitor group when no competitor is chosen', () => {
    expect(planNewCompany({ details, visibleCompanies: [company({})], newGroupId: 'user-new' })).toEqual({
      peerGroup: 'user-new',
    })
  })

  it("joins the chosen competitor's group", () => {
    const withCompetitor = { ...details, competitorOf: 'company-1' }
    expect(planNewCompany({ details: withCompetitor, visibleCompanies: [company({})], newGroupId: 'user-new' })).toEqual({
      peerGroup: 'lamland-pc-resellers',
    })
  })

  it('rejects a competitor the user cannot see', async () => {
    const error = await rejection(() =>
      planNewCompany({ details: { ...details, competitorOf: 'someone-elses' }, visibleCompanies: [company({})], newGroupId: 'g' })
    )
    expect(error.status).toBe(400)
  })

  it('rejects a name clash, ignoring case and spacing', async () => {
    const shared = await rejection(() =>
      planNewCompany({ details: { ...details, name: '  ressett ' }, visibleCompanies: [company({})], newGroupId: 'g' })
    )
    expect(shared.status).toBe(409)
    expect(shared.message).toContain('case study')

    const own = await rejection(() =>
      planNewCompany({
        details,
        visibleCompanies: [company({ name: 'Kiwi Repairs', user_id: 'user-1' })],
        newGroupId: 'g',
      })
    )
    expect(own.message).toBe('You already have a company called Kiwi Repairs.')
  })
})

describe('readStatementFile', () => {
  it('accepts a CSV file', () => {
    const file = new File(['a,b'], 'ressett.CSV')
    expect(readStatementFile(file)).toBe(file)
  })

  it.each([
    ['no file', null],
    ['a text field', 'not a file'],
    ['an empty file', new File([], 'empty.csv')],
    ['a PDF', new File(['%PDF'], 'report.pdf')],
    ['a file over 1 MB', new File([new Uint8Array(MAX_STATEMENT_UPLOAD_BYTES + 1)], 'big.csv')],
  ])('rejects %s', async (_label, value) => {
    const error = await rejection(() => readStatementFile(value as FormDataEntryValue | null))
    expect(error.status).toBe(400)
  })
})

describe('reviewStatementUpload and assertReadyToSave', () => {
  const ressett = caseStudy('Ressett')

  it('passes a correct template with every check run', async () => {
    const review = await reviewStatementUpload(new File([buildStatementTemplate(ressett.years)], 'ressett.csv'))
    expect(review.errors).toEqual([])
    expect(review.failedChecks).toEqual([])
    expect(review.checksRun).toBeGreaterThan(0)
    expect(() => assertReadyToSave(review, false)).not.toThrow()
  })

  it('blocks a failed check until the user confirms', async () => {
    const wrong = ressett.years.map((year, index) =>
      index === 0 ? { ...year, lines: { ...year.lines, total_assets: (year.lines.total_assets ?? 0) + 5 } } : year
    )
    const review = await reviewStatementUpload(new File([buildStatementTemplate(wrong)], 'ressett.csv'))
    expect(review.failedChecks.length).toBeGreaterThan(0)

    const error = await rejection(() => assertReadyToSave(review, false))
    expect(error.status).toBe(400)
    expect(error.details).toHaveProperty('failedChecks')
    expect(() => assertReadyToSave(review, true)).not.toThrow()
  })

  it('always blocks file errors, even when confirmed', async () => {
    const review = await reviewStatementUpload(new File(['Line,31/03/2025\nRevenue,lots'], 'bad.csv'))
    expect(review.errors.length).toBeGreaterThan(0)
    const error = await rejection(() => assertReadyToSave(review, true))
    expect(error.details).toHaveProperty('errors')
  })
})

describe('linesFromStatements', () => {
  it.each(CIMA_CASE_STUDIES.map((study) => study.name))('round-trips %s through database rows', (name) => {
    const original = caseStudy(name)
    const rebuilt = statementsFromLines(original, linesFromStatements(original.years))
    expect(rebuilt.years).toEqual(original.years)
  })
})
