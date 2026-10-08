import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listModelCapabilities } from '@/lib/ai/models'

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request)

    return successResponse({ models: listModelCapabilities() })
  } catch (error) {
    return handleRouteError(error)
  }
}
