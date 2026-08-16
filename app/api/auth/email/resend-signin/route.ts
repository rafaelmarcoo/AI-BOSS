import type { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  applyPendingSignInCookie,
  getPendingSignInEmail,
} from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const email = getPendingSignInEmail(request)
    if (!email) {
      throw new ApiError(
        401,
        'AUTH_REQUIRED',
        'Enter your email and password again before requesting another link.'
      )
    }

    const callbackUrl = new URL('/auth/callback', request.url)
    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        error.message ?? 'Unable to resend the sign-in link.'
      )
    }

    const response = successResponse(
      { sent: true },
      undefined,
      'A new sign-in link has been sent.'
    )
    applyPendingSignInCookie(response, email)
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
