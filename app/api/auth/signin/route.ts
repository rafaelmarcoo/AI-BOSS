import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateSignInPayload,
} from '@/lib/api/validation'
import { applyPendingSignInCookie } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const payload = assertValid(validateSignInPayload(await readJsonBody(request)))
    const supabase = createServerSupabaseClient()
    const { data: passwordData, error: passwordError } =
      await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      })

    if (passwordError || !passwordData.session || !passwordData.user?.email) {
      throw new ApiError(401, 'AUTH_INVALID', 'Invalid email or password.')
    }

    // The password session proves the first step only. Revoke its refresh token;
    // the application session is issued later, after the email link is confirmed.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
    if (signOutError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to prepare email confirmation.')
    }

    const callbackUrl = new URL('/auth/callback', request.url)
    const { error } = await supabase.auth.signInWithOtp({
      email: payload.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        error.message ?? 'Unable to send the sign-in link.'
      )
    }

    const response = successResponse(
      { email: payload.email, nextStep: 'check-email' as const },
      undefined,
      'Check your email for the sign-in link.'
    )

    applyPendingSignInCookie(response, payload.email)

    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
