import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  deleteFinancialAnalysisRun,
  getFinancialAnalysisRun,
} from '@/lib/financial-analysis/persistence'

interface RouteContext {
  params: Promise<{ analysisRunId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { analysisRunId } = await context.params
    const report = await getFinancialAnalysisRun(analysisRunId, user.id)
    return successResponse({ report })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { analysisRunId } = await context.params
    const result = await deleteFinancialAnalysisRun(analysisRunId, user.id)
    return successResponse({ ...result, analysisRunId })
  } catch (error) {
    return handleRouteError(error)
  }
}
