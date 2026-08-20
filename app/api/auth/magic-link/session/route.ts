import type { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateMagicLinkSessionPayload,
} from '@/lib/api/validation'
import {
  applySessionCookies,
  getPendingSignInEmail,
  getPendingSignUpEmail,
} from '@/lib/auth'
import {
  COOKIE_MAGIC_LINK_STATE,
  COOKIE_SIGNUP_STATE,
  createServerSupabaseClient,
} from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const payload = assertValid(
      validateMagicLinkSessionPayload(await readJsonBody(request))
    )
    const expectedEmail =
      payload.flow === 'signup'
        ? getPendingSignUpEmail(request)
        : getPendingSignInEmail(request)

    if (!expectedEmail) {
      throw new ApiError(401, 'AUTH_INVALID', 'This sign-in link is invalid or expired.')
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    })

    if (error || !data.session || !data.user?.email) {
      throw new ApiError(401, 'AUTH_INVALID', 'This sign-in link is invalid or expired.')
    }

    if (data.user.email.toLowerCase() !== expectedEmail.toLowerCase()) {
      throw new ApiError(401, 'AUTH_INVALID', 'This sign-in link is invalid or expired.')
    }

    const response = successResponse(
      { user: { id: data.user.id, email: data.user.email } },
      undefined,
      'Signed in successfully.'
    )
    await applySessionCookies(response, data.session)
    response.cookies.delete(
      payload.flow === 'signup' ? COOKIE_SIGNUP_STATE : COOKIE_MAGIC_LINK_STATE
    )

    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
