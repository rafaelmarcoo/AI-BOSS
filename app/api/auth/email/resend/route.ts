import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateEmailPayload,
} from '@/lib/api/validation'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const payload = assertValid(validateEmailPayload(await readJsonBody(request)))
    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: payload.email,
    })

    if (error) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        error.message ?? 'Unable to resend the verification email.'
      )
    }

    return successResponse(
      { sent: true },
      undefined,
      'A new verification email has been sent.'
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
