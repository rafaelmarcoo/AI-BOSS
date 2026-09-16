import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateEmailPayload,
} from '@/lib/api/validation'
import { applyPendingSignUpCookie } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const payload = assertValid(validateEmailPayload(await readJsonBody(request)))
    const supabase = createServerSupabaseClient()
    const callbackUrl = new URL('/auth/callback', request.url)
    callbackUrl.searchParams.set('flow', 'signup')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: payload.email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        error.message ?? 'Unable to resend the verification email.'
      )
    }

    const response = successResponse(
      { sent: true },
      undefined,
      'A new verification email has been sent.'
    )
    applyPendingSignUpCookie(response, payload.email)

    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
