import { ZodError } from 'zod'
import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { readJsonBody } from '@/lib/api/validation'
import { runFinancialAnalysis } from '@/lib/financial-analysis/orchestrator'
import {
  listFinancialAnalysisRuns,
  toFinancialAnalysisRunView,
} from '@/lib/financial-analysis/persistence'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const reports = await listFinancialAnalysisRuns(user.id)
    return successResponse({ reports })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const run = await runFinancialAnalysis({
      userId: user.id,
      request: await readJsonBody(request),
    })
    return successResponse(
      { report: toFinancialAnalysisRunView(run) },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return handleRouteError(new ApiError(
        400,
        'BAD_REQUEST',
        'Select a valid financial source and currency.',
        error.flatten()
      ))
    }
    return handleRouteError(error)
  }
}
