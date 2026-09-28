import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { requireCompanyAdmin } from '@/lib/companies'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { listFinancialAnalysisBaselineOptions } from '@/lib/financial-analysis/baselines'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    await requireCompanyAdmin(user.id)
    const baselines = await listFinancialAnalysisBaselineOptions(user.id)
    return successResponse({ baselines })
  } catch (error) {
    return handleRouteError(error)
  }
}
