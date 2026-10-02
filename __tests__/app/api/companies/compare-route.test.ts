/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as compare } from '@/app/api/companies/compare/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import { listStatementLines, listVisibleCompanies } from '@/lib/company-analysis/persistence'
import { linesFromStatements, statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'
import type { AnalysedCompany, CompanyStatementLine } from '@/types/database'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/company-analysis/persistence', () => ({
  listVisibleCompanies: jest.fn(),
  listStatementLines: jest.fn(),
}))

const ressettId = '11111111-1111-4111-8111-111111111111'
const fixxuppId = '22222222-2222-4222-8222-222222222222'

function company(id: string, name: string): AnalysedCompany {
  return {
    id,
    user_id: null,
    name,
    industry: 'PC reselling',
    peer_group: 'lamland-pc-resellers',
    currency: 'L$',
    amounts_in: 'millions',
    description: null,
    source: 'CIMA pre-seen material',
    created_at: '2026-09-25T00:00:00.000Z',
    updated_at: '2026-09-25T00:00:00.000Z',
  }
}

function linesFor(name: string, companyId: string) {
  const statements = statementsFromCaseStudy(CIMA_CASE_STUDIES.find((study) => study.name === name)!)
  return linesFromStatements(statements.years).map((line) => ({ ...line, company_id: companyId })) as CompanyStatementLine[]
}

const request = (query: string) => compare(new NextRequest(`http://localhost/api/companies/compare${query}`))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireAuthenticatedUser).mockResolvedValue({
    accessToken: 'access-token',
    user: { id: 'user-1', email: 'owner@example.com' },
  } as Awaited<ReturnType<typeof requireAuthenticatedUser>>)
  jest.mocked(listVisibleCompanies).mockResolvedValue([company(ressettId, 'Ressett'), company(fixxuppId, 'Fixxupp')])
  jest.mocked(listStatementLines).mockImplementation(async (id) =>
    id === ressettId ? linesFor('Ressett', ressettId) : linesFor('Fixxupp', fixxuppId)
  )
})

describe('GET /api/companies/compare', () => {
  it('compares two visible companies with the same engine as the chat', async () => {
    const response = await request(`?first=${ressettId}&second=${fixxuppId}`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.companies.first).toMatchObject({ name: 'Ressett', isOwn: false, fiscalYearEnd: '2025-03-31' })
    expect(body.data.comparison.size.comparable).toBe(true)
    expect(body.data.comparison.ratios.find((ratio: { key: string }) => ratio.key === 'operating_margin')).toMatchObject({
      first: 14,
      stronger: 'Ressett',
    })
  })

  it.each([
    ['a missing company', `?first=${ressettId}`, 400],
    ['the same company twice', `?first=${ressettId}&second=${ressettId}`, 400],
    ['a malformed id', `?first=nope&second=${fixxuppId}`, 404],
  ])('refuses %s', async (_case, query, status) => {
    expect((await request(query)).status).toBe(status)
  })

  it("refuses a company the user can't see", async () => {
    jest.mocked(listVisibleCompanies).mockResolvedValue([company(ressettId, 'Ressett')])
    const response = await request(`?first=${ressettId}&second=${fixxuppId}`)

    expect(response.status).toBe(404)
    expect(listStatementLines).not.toHaveBeenCalled()
  })
})
