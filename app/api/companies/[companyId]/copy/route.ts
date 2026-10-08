import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { assertCompanyId } from '@/lib/company-analysis/company-id'
import { copyCompanyForUser } from '@/lib/company-analysis/persistence'

interface RouteContext {
  params: Promise<{ companyId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const companyId = assertCompanyId((await context.params).companyId)
    const company = await copyCompanyForUser(user.id, companyId)

    return successResponse(
      { company },
      { status: 201 },
      `${company.name} was added to your companies. You can edit it.`
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
