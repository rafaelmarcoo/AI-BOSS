import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { deleteUserCompany } from '@/lib/company-analysis/persistence'

interface RouteContext {
  params: Promise<{ companyId: string }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { companyId } = await context.params

    if (!UUID_PATTERN.test(companyId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Company not found. Only companies you added can be deleted.')
    }

    await deleteUserCompany(user.id, companyId)
    return successResponse({ companyId }, undefined, 'Company deleted.')
  } catch (error) {
    return handleRouteError(error)
  }
}
