import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  createDashboardLayout,
  listDashboardLayouts,
} from '@/lib/gen-ui/dashboard-layout-persistence'
import { DashboardLayoutCreateSchema } from '@/lib/gen-ui/dashboard-layout-schema'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    return successResponse({ layouts: await listDashboardLayouts(user.id) })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const parsed = DashboardLayoutCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Check the dashboard layout and try again.',
        parsed.error.flatten(),
      )
    }

    return successResponse(
      { layout: await createDashboardLayout(user.id, parsed.data) },
      { status: 201 },
      'Dashboard layout saved.',
    )
  } catch (error) {
    return handleRouteError(error)
  }
}

