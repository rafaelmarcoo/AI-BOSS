import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateSignInPayload,
} from '@/lib/api/validation'
import { applySessionCookies } from '@/lib/auth'
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    // This is a local testing escape hatch, not an alternate production auth flow.
    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(404, 'NOT_FOUND', 'Not found.')
    }

    const payload = assertValid(validateSignInPayload(await readJsonBody(request)))
    const admin = createAdminSupabaseClient()
    const { data: profile, error: profileError } = await admin
      .from('users')
      .select('id')
      .eq('email', payload.email)
      .maybeSingle()

    if (profileError || !profile) {
      throw new ApiError(401, 'AUTH_INVALID', 'Invalid email or password.')
    }

    const { error: confirmationError } = await admin.auth.admin.updateUserById(
      profile.id,
      { email_confirm: true }
    )

    if (confirmationError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to confirm the test account.')
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    })

    if (error || !data.session || !data.user?.email) {
      throw new ApiError(401, 'AUTH_INVALID', 'Invalid email or password.')
    }

    const response = successResponse(
      { user: { id: data.user.id, email: data.user.email } },
      undefined,
      'Signed in with the development email bypass.'
    )
    await applySessionCookies(response, data.session)

    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
