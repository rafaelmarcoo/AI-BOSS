import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  getGenUiPersonalization,
  updateGenUiPersonalization,
} from '@/lib/gen-ui/preferences-persistence'
import { GenUiPreferencesUpdateSchema } from '@/lib/gen-ui/preferences-schema'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    return successResponse({
      preferences: await getGenUiPersonalization(user.id),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const parsed = GenUiPreferencesUpdateSchema.safeParse(await request.json())

    if (!parsed.success) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Check the personalization settings and try again.',
        parsed.error.flatten()
      )
    }

    return successResponse(
      {
        preferences: await updateGenUiPersonalization(user.id, parsed.data),
      },
      undefined,
      'AI-BOSS personalization updated.'
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
