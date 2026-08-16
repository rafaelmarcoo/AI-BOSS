import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import {
  assertValid,
  readJsonBody,
  validateSignUpPayload,
} from '@/lib/api/validation'
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

    const supabase = createServerSupabaseClient()
    const { data: signUpData, error: createUserError } =
      await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
      })

    if (
      createUserError ||
      !signUpData.user ||
      signUpData.user.identities?.length === 0
    ) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        createUserError?.message ?? 'Unable to create user.'
      )
    }

    const createdUser = signUpData.user

    if (signUpData.session) {
      await admin.auth.admin.deleteUser(createdUser.id)
      throw new ApiError(
        500,
        'INTERNAL_ERROR',
        'Email confirmation must be enabled in Supabase before users can sign up.'
      )
    }

    const { error: profileError } = await admin.from('users').upsert(
      {
        id: createdUser.id,
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
      await admin.auth.admin.deleteUser(createdUser.id)
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to create user profile.')
    }

    if (payload.userType === 'admin') {
      const { error: companyError } = await admin.from('companies').insert({
        name: companyName,
        created_by: createdUser.id,
      })

      if (companyError) {
        await admin.from('users').delete().eq('id', createdUser.id)
        await admin.auth.admin.deleteUser(createdUser.id)
        throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to create company.')
      }
    }

    const response = successResponse(
      {
        user: {
          id: createdUser.id,
          email: payload.email,
          companyName,
          userType: payload.userType,
        },
        nextStep: 'verify-email' as const,
      },
      { status: 201 },
      'Account created. Check your email for the verification link.'
    )

    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
