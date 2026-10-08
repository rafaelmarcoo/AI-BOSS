import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { assertCompanyId } from '@/lib/company-analysis/company-id'
import { listVisibleCompanies } from '@/lib/company-analysis/persistence'
import { compareCompanies } from '@/lib/company-analysis/statement-analysis'
import { loadCompany } from '@/lib/company-analysis/tool-support'


export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const firstValue = request.nextUrl.searchParams.get('first')
    const secondValue = request.nextUrl.searchParams.get('second')

    if (!firstValue || !secondValue) {
      throw new ApiError(400, 'BAD_REQUEST', 'Pick two companies to compare.')
    }
    const firstId = assertCompanyId(firstValue)
    const secondId = assertCompanyId(secondValue)
    if (firstId === secondId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Pick two different companies to compare.')
    }

    const visible = await listVisibleCompanies(user.id)
    const first = visible.find((company) => company.id === firstId)
    const second = visible.find((company) => company.id === secondId)
    if (!first || !second) throw new ApiError(404, 'NOT_FOUND', "Couldn't find one of those companies.")

    const [firstLoaded, secondLoaded] = await Promise.all([loadCompany(first), loadCompany(second)])
    const comparison = compareCompanies(firstLoaded.statements, secondLoaded.statements)

    const describe = (company: typeof first, loaded: typeof firstLoaded) => ({
      id: company.id,
      name: company.name,
      source: company.source,
      isOwn: company.user_id === user.id,
      fiscalYearEnd: loaded.statements.years[0]?.fiscalYearEnd ?? null,
    })

    return successResponse({
      comparison,
      companies: { first: describe(first, firstLoaded), second: describe(second, secondLoaded) },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
