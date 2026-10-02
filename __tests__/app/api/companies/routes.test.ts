/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as listCompanies, POST as saveCompany } from '@/app/api/companies/route'
import { POST as previewCompany } from '@/app/api/companies/preview/route'
import { DELETE as deleteCompany, PUT as editCompany } from '@/app/api/companies/[companyId]/route'
import { POST as copyCompany } from '@/app/api/companies/[companyId]/copy/route'
import { ApiError } from '@/lib/api/errors'
import { requireAuthenticatedUser } from '@/lib/auth'
import { CIMA_CASE_STUDIES } from '@/lib/company-analysis/cima-case-studies'
import {
  copyCompanyForUser,
  createUserCompany,
  deleteUserCompany,
  listCompanySummaries,
  updateUserCompany,
} from '@/lib/company-analysis/persistence'
import { statementsFromCaseStudy } from '@/lib/company-analysis/statement-analysis'
import { buildStatementTemplate } from '@/lib/company-analysis/statement-template'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

// Only the database layer is mocked; the file reading and checks run for real.
jest.mock('@/lib/company-analysis/persistence', () => ({
  createUserCompany: jest.fn(),
  deleteUserCompany: jest.fn(),
  listCompanySummaries: jest.fn(),
  updateUserCompany: jest.fn(),
  copyCompanyForUser: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockCreateUserCompany = jest.mocked(createUserCompany)
const mockDeleteUserCompany = jest.mocked(deleteUserCompany)
const mockListCompanySummaries = jest.mocked(listCompanySummaries)
const mockUpdateUserCompany = jest.mocked(updateUserCompany)
const mockCopyCompanyForUser = jest.mocked(copyCompanyForUser)

const ressett = statementsFromCaseStudy(CIMA_CASE_STUDIES.find((study) => study.name === 'Ressett')!)
const goodCsv = buildStatementTemplate(ressett.years)
const unbalancedCsv = buildStatementTemplate(
  ressett.years.map((year, index) =>
    index === 0 ? { ...year, lines: { ...year.lines, total_assets: (year.lines.total_assets ?? 0) + 5 } } : year
  )
)

function uploadRequest(url: string, csv: string, fields: Record<string, string> = {}) {
  const body = new FormData()
  body.set('file', new File([csv], 'kiwi.csv', { type: 'text/csv' }))
  for (const [key, value] of Object.entries(fields)) body.set(key, value)
  return new NextRequest(url, { method: 'POST', body })
}

const details = { name: 'Kiwi Repairs', currency: 'NZD', amountsIn: 'millions' }

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuthenticatedUser.mockResolvedValue({
    accessToken: 'access-token',
    user: { id: 'user-1', email: 'owner@example.com' },
  } as Awaited<ReturnType<typeof requireAuthenticatedUser>>)
})

describe('POST /api/companies/preview', () => {
  it('returns the review without saving', async () => {
    const response = await previewCompany(uploadRequest('http://localhost/api/companies/preview', unbalancedCsv))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.review.years).toHaveLength(2)
    expect(body.data.review.failedChecks.length).toBeGreaterThan(0)
    expect(mockCreateUserCompany).not.toHaveBeenCalled()
  })

  it('requires sign-in', async () => {
    mockRequireAuthenticatedUser.mockRejectedValue(new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required.'))
    const response = await previewCompany(uploadRequest('http://localhost/api/companies/preview', goodCsv))
    expect(response.status).toBe(401)
  })
})

describe('POST /api/companies', () => {
  it('saves a clean upload for the signed-in user', async () => {
    mockCreateUserCompany.mockResolvedValue({ id: 'new-company', name: 'Kiwi Repairs' } as Awaited<
      ReturnType<typeof createUserCompany>
    >)
    const response = await saveCompany(uploadRequest('http://localhost/api/companies', goodCsv, details))

    expect(response.status).toBe(201)
    expect(mockCreateUserCompany).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', fileName: 'kiwi.csv', years: ressett.years })
    )
  })

  it('refuses failed checks unless confirmed', async () => {
    const refused = await saveCompany(uploadRequest('http://localhost/api/companies', unbalancedCsv, details))
    expect(refused.status).toBe(400)
    expect((await refused.json()).error.details).toHaveProperty('failedChecks')
    expect(mockCreateUserCompany).not.toHaveBeenCalled()

    mockCreateUserCompany.mockResolvedValue({ id: 'new-company', name: 'Kiwi Repairs' } as Awaited<
      ReturnType<typeof createUserCompany>
    >)
    const confirmed = await saveCompany(
      uploadRequest('http://localhost/api/companies', unbalancedCsv, { ...details, confirmedChecks: 'true' })
    )
    expect(confirmed.status).toBe(201)
  })

  it('refuses missing company details before reading the file', async () => {
    const response = await saveCompany(uploadRequest('http://localhost/api/companies', goodCsv, { name: 'Kiwi Repairs' }))
    expect(response.status).toBe(400)
    expect(mockCreateUserCompany).not.toHaveBeenCalled()
  })

  it('passes on a name clash from the database layer', async () => {
    mockCreateUserCompany.mockRejectedValue(new ApiError(409, 'CONFLICT', 'You already have a company called Kiwi Repairs.'))
    const response = await saveCompany(uploadRequest('http://localhost/api/companies', goodCsv, details))
    expect(response.status).toBe(409)
  })
})

describe('GET /api/companies', () => {
  it("lists the user's visible companies", async () => {
    mockListCompanySummaries.mockResolvedValue([])
    const response = await listCompanies(new NextRequest('http://localhost/api/companies'))

    expect(response.status).toBe(200)
    expect(mockListCompanySummaries).toHaveBeenCalledWith('user-1')
  })
})

describe('PUT /api/companies/[companyId]', () => {
  const companyId = '0b8f3a52-6a3e-4c1b-9d7e-2f4a5b6c7d8e'
  const updated = { id: companyId, name: 'Kiwi Repairs' } as Awaited<ReturnType<typeof updateUserCompany>>

  function editRequest(fields: Record<string, string>, csv?: string, id = companyId) {
    const body = new FormData()
    if (csv !== undefined) body.set('file', new File([csv], 'new.csv', { type: 'text/csv' }))
    for (const [key, value] of Object.entries(fields)) body.set(key, value)
    return editCompany(new NextRequest(`http://localhost/api/companies/${id}`, { method: 'PUT', body }), {
      params: Promise.resolve({ companyId: id }),
    })
  }

  it('saves details only when no file is sent', async () => {
    mockUpdateUserCompany.mockResolvedValue(updated)
    const response = await editRequest(details)

    expect(response.status).toBe(200)
    expect(mockUpdateUserCompany).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', companyId, years: null, fileName: null })
    )
  })

  it('checks a new file and passes its figures on', async () => {
    mockUpdateUserCompany.mockResolvedValue(updated)
    const response = await editRequest(details, goodCsv)

    expect(response.status).toBe(200)
    expect(mockUpdateUserCompany).toHaveBeenCalledWith(
      expect.objectContaining({ years: ressett.years, fileName: 'new.csv' })
    )
  })

  it('refuses a new file with failed checks unless confirmed', async () => {
    const response = await editRequest(details, unbalancedCsv)

    expect(response.status).toBe(400)
    expect((await response.json()).error.details).toHaveProperty('failedChecks')
    expect(mockUpdateUserCompany).not.toHaveBeenCalled()
  })

  it('answers 404 for a malformed id', async () => {
    const response = await editRequest(details, undefined, 'not-an-id')
    expect(response.status).toBe(404)
    expect(mockUpdateUserCompany).not.toHaveBeenCalled()
  })
})

describe('POST /api/companies/[companyId]/copy', () => {
  const companyId = '0b8f3a52-6a3e-4c1b-9d7e-2f4a5b6c7d8e'
  const copyRequest = (id: string) =>
    copyCompany(new NextRequest(`http://localhost/api/companies/${id}/copy`, { method: 'POST' }), {
      params: Promise.resolve({ companyId: id }),
    })

  it("copies the company for the signed-in user", async () => {
    mockCopyCompanyForUser.mockResolvedValue({ id: 'copy-id', name: 'Ressett (copy)' } as Awaited<ReturnType<typeof copyCompanyForUser>>)
    const response = await copyRequest(companyId)

    expect(response.status).toBe(201)
    expect((await response.json()).message).toBe('Ressett (copy) was added to your companies. You can edit it.')
    expect(mockCopyCompanyForUser).toHaveBeenCalledWith('user-1', companyId)
  })

  it('answers 404 for a malformed id', async () => {
    expect((await copyRequest('not-an-id')).status).toBe(404)
    expect(mockCopyCompanyForUser).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/companies/[companyId]', () => {
  const companyId = '0b8f3a52-6a3e-4c1b-9d7e-2f4a5b6c7d8e'

  it("deletes the user's own company", async () => {
    const response = await deleteCompany(new NextRequest(`http://localhost/api/companies/${companyId}`), {
      params: Promise.resolve({ companyId }),
    })
    expect(response.status).toBe(200)
    expect(mockDeleteUserCompany).toHaveBeenCalledWith('user-1', companyId)
  })

  it('answers 404 for a malformed id without touching the database', async () => {
    const response = await deleteCompany(new NextRequest('http://localhost/api/companies/not-an-id'), {
      params: Promise.resolve({ companyId: 'not-an-id' }),
    })
    expect(response.status).toBe(404)
    expect(mockDeleteUserCompany).not.toHaveBeenCalled()
  })
})
