import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listLatestFinancialMetricValuesBySource } from '@/lib/financial-data/persistence'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const metrics = await listLatestFinancialMetricValuesBySource(user.id)

    return successResponse({ metrics })
  } catch (error) {
    return handleRouteError(error)
  }
}
