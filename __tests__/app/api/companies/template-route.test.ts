/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as downloadFigures } from '@/app/api/companies/[companyId]/template/route'
import { ApiError } from '@/lib/api/errors'
import { requireAuthenticatedUser } from '@/lib/auth'
import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { listStatementLines, listVisibleCompanies } from '@/lib/company-analysis/persistence'
import { linesFromStatements, statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'
import { parseStatementCsv } from '@/lib/company-analysis/statement-csv'
import type { AnalysedCompany, CompanyStatementLine } from '@/types/database'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/company-analysis/persistence', () => ({
  listVisibleCompanies: jest.fn(),
  listStatementLines: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockListVisibleCompanies = jest.mocked(listVisibleCompanies)
const mockListStatementLines = jest.mocked(listStatementLines)

const companyId = '0b8f3a52-6a3e-4c1b-9d7e-2f4a5b6c7d8e'
const kiwi: AnalysedCompany = {
  id: companyId,
  user_id: 'user-1',
  name: 'Kiwi Salons',
  industry: null,
  peer_group: 'user-group',
  currency: 'D$',
  amounts_in: 'millions',
  description: null,
  source: 'Uploaded by you: kiwi.csv',
  created_at: '2026-10-02T00:00:00.000Z',
  updated_at: '2026-10-02T00:00:00.000Z',
}
const trimayr = statementsFromCaseStudy(CIMA_CASE_STUDIES.find((study) => study.name === 'Trimayr')!)
const savedLines = linesFromStatements(trimayr.years).map((line, index) => ({
  ...line,
  id: `line-${index}`,
  company_id: companyId,
  created_at: '2026-10-02T00:00:00.000Z',
  updated_at: '2026-10-02T00:00:00.000Z',
})) as CompanyStatementLine[]

function request(id: string) {
  return downloadFigures(new NextRequest(`http://localhost/api/companies/${id}/template`), {
    params: Promise.resolve({ companyId: id }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuthenticatedUser.mockResolvedValue({
    accessToken: 'access-token',
    user: { id: 'user-1', email: 'owner@example.com' },
  } as Awaited<ReturnType<typeof requireAuthenticatedUser>>)
  mockListVisibleCompanies.mockResolvedValue([kiwi])
  mockListStatementLines.mockResolvedValue(savedLines)
})

describe('GET /api/companies/[companyId]/template', () => {
  it('returns the saved figures as a template that uploads again unchanged', async () => {
    const response = await request(companyId)
    const csv = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="kiwi-salons-statements.csv"')

    const reread = parseStatementCsv(new TextEncoder().encode(csv))
    expect(reread.errors).toEqual([])
    expect(reread.years).toEqual(trimayr.years)
  })

  it("refuses a company the user can't see", async () => {
    mockListVisibleCompanies.mockResolvedValue([])
    const response = await request(companyId)

    expect(response.status).toBe(404)
    expect(mockListStatementLines).not.toHaveBeenCalled()
  })

  it('answers 404 for a malformed id without touching the database', async () => {
    const response = await request('not-an-id')

    expect(response.status).toBe(404)
    expect(mockListVisibleCompanies).not.toHaveBeenCalled()
  })

  it('requires sign-in', async () => {
    mockRequireAuthenticatedUser.mockRejectedValue(new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required.'))
    expect((await request(companyId)).status).toBe(401)
  })
})
