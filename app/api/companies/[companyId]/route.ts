import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { assertCompanyId } from '@/lib/company-analysis/company-id'
import { deleteUserCompany } from '@/lib/company-analysis/persistence'

interface RouteContext {
  params: Promise<{ companyId: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { companyId } = await context.params

    assertCompanyId(companyId, "Couldn't find that company. You can only delete companies you added.")

    await deleteUserCompany(user.id, companyId)
    return successResponse({ companyId }, undefined, 'Company deleted.')
  } catch (error) {
    return handleRouteError(error)
  }
}
