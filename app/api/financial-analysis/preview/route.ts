import { ZodError } from 'zod'
import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { readJsonBody } from '@/lib/api/validation'
import {
  FinancialAnalysisPreviewRequestSchema,
  previewFinancialAnalysis,
} from '@/lib/financial-analysis/timeline'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const previewRequest = FinancialAnalysisPreviewRequestSchema.parse(
      await readJsonBody(request)
    )
    const preview = await previewFinancialAnalysis({
      userId: user.id,
      request: previewRequest,
    })
    return successResponse({ preview })
  } catch (error) {
    if (error instanceof ZodError) {
      return handleRouteError(new ApiError(
        400,
        'BAD_REQUEST',
        'Select between 2 and 12 compatible financial sources in one currency.',
        error.flatten()
      ))
    }
    return handleRouteError(error)
  }
}
