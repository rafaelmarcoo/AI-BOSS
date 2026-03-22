import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateSignUpPayload,
} from '@/lib/api/validation'
import { applySessionCookies } from '@/lib/auth'
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const payload = assertValid(validateSignUpPayload(await readJsonBody(request)))
    const admin = createAdminSupabaseClient()

    const { data: createdUser, error: createUserError } =
      await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
      })

    if (createUserError || !createdUser.user) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        createUserError?.message ?? 'Unable to create user.'
      )
    }

    const { error: profileError } = await admin.from('users').upsert(
      {
        id: createdUser.user.id,
        email: payload.email,
        full_name: payload.fullName ?? null,
        company_name: payload.companyName ?? null,
      },
      {
        onConflict: 'id',
      }
    )

    if (profileError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to create user profile.')
    }

    const supabase = createServerSupabaseClient()
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      })

    if (signInError || !signInData.session || !signInData.user?.email) {
      throw new ApiError(
        500,
        'INTERNAL_ERROR',
        signInError?.message ?? 'User created, but automatic sign in failed.'
      )
    }

    const response = successResponse(
      {
        user: {
          id: signInData.user.id,
          email: signInData.user.email,
        },
        session: {
          accessToken: signInData.session.access_token,
          refreshToken: signInData.session.refresh_token,
          expiresIn: signInData.session.expires_in,
        },
      },
      { status: 201 },
      'Account created successfully.'
    )

    await applySessionCookies(response, signInData.session)

    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
