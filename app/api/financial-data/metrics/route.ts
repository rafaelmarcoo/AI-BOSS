import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { requireCompanyAdmin } from '@/lib/companies'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    await requireCompanyAdmin(user.id)
    const metrics = await readSourceAwareMetrics(user.id)

    return successResponse(metrics)
  } catch (error) {
    return handleRouteError(error)
  }
}
