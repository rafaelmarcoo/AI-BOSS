import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateSignInPayload,
} from '@/lib/api/validation'
import { applySessionCookies } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const payload = assertValid(validateSignInPayload(await readJsonBody(request)))
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword(payload)

    if (error || !data.session || !data.user?.email) {
      throw new ApiError(
        401,
        'AUTH_INVALID',
        error?.message ?? 'Invalid email or password.'
      )
    }

    const response = successResponse(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in,
        },
      },
      undefined,
      'Signed in successfully.'
    )

    await applySessionCookies(response, data.session)

    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
