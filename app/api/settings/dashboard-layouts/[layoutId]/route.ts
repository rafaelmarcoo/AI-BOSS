import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  deleteDashboardLayout,
  updateDashboardLayout,
} from '@/lib/gen-ui/dashboard-layout-persistence'
import { DashboardLayoutUpdateSchema } from '@/lib/gen-ui/dashboard-layout-schema'

interface RouteContext {
  params: Promise<{ layoutId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { layoutId } = await context.params
    const parsed = DashboardLayoutUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Check the dashboard layout and try again.',
        parsed.error.flatten(),
      )
    }

    return successResponse(
      { layout: await updateDashboardLayout(user.id, layoutId, parsed.data) },
      undefined,
      'Dashboard layout updated.',
    )
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { layoutId } = await context.params
    await deleteDashboardLayout(user.id, layoutId)
    return successResponse({ deleted: true, layoutId })
  } catch (error) {
    return handleRouteError(error)
  }
}

