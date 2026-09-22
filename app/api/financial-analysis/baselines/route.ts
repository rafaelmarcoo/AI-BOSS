import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { listFinancialAnalysisBaselineOptions } from '@/lib/financial-analysis/baselines'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const baselines = await listFinancialAnalysisBaselineOptions(user.id)
    return successResponse({ baselines })
  } catch (error) {
    return handleRouteError(error)
  }
}
