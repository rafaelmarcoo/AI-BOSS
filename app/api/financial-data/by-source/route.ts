import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { listLatestFinancialMetricsBySource } from '@/lib/financial-data/persistence'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const metrics = await listLatestFinancialMetricsBySource(user.id)
    return successResponse({ metrics })
  } catch (error) {
    return handleRouteError(error)
  }
}
