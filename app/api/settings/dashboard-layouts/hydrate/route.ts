import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hydrateDashboardLayout } from '@/lib/gen-ui/dashboard-layout-hydration'
import { DashboardLayoutHydrateSchema } from '@/lib/gen-ui/dashboard-layout-schema'

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const parsed = DashboardLayoutHydrateSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Check the dashboard layout and try again.',
        parsed.error.flatten(),
      )
    }

    return successResponse({
      hydration: await hydrateDashboardLayout(user.id, parsed.data.payload),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

