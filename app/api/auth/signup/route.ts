import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateSignUpPayload,
} from '@/lib/api/validation'
import { applySessionCookies } from '@/lib/auth'
import { findCompanyName, getJoinableCompanyNames } from '@/lib/companies'
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const payload = assertValid(validateSignUpPayload(await readJsonBody(request)))
    const admin = createAdminSupabaseClient()
    const companies = await getJoinableCompanyNames()
    const existingCompanyName = findCompanyName(companies, payload.companyName)

    if (payload.userType === 'admin' && existingCompanyName) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'That company already exists. Join it as an employee instead.',
        { companyName: 'A company with this name already exists.' }
      )
    }

    if (payload.userType === 'employee' && !existingCompanyName) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Select an existing company to join.',
        { companyName: 'Select an existing company.' }
      )
    }

    const companyName = existingCompanyName ?? payload.companyName

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
        company_name: companyName,
        user_type: payload.userType,
      },
      {
        onConflict: 'id',
      }
    )

    if (profileError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to create user profile.')
    }

    if (payload.userType === 'admin') {
      const { error: companyError } = await admin.from('companies').insert({
        name: companyName,
        created_by: createdUser.user.id,
      })

      if (companyError) {
        await admin.from('users').delete().eq('id', createdUser.user.id)
        await admin.auth.admin.deleteUser(createdUser.user.id)
        throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to create company.')
      }
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
          companyName,
          userType: payload.userType,
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
