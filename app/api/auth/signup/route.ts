import type { User } from '@supabase/supabase-js'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { applySessionCookies } from '@/lib/auth'
import {
  assertValid,
  readJsonBody,
  validateSignUpPayload,
} from '@/lib/api/validation'
import { findCompanyByJoinCode, findCompanyByName } from '@/lib/companies'
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const bypassEmail = request.headers.get('x-ai-boss-test-bypass') === 'true'
    if (bypassEmail && process.env.NODE_ENV === 'production') {
      throw new ApiError(404, 'NOT_FOUND', 'Not found.')
    }

    const payload = assertValid(validateSignUpPayload(await readJsonBody(request)))
    const admin = createAdminSupabaseClient()
    const company =
      payload.userType === 'admin'
        ? await findCompanyByName(payload.companyName)
        : await findCompanyByJoinCode(payload.companyCode)

    if (payload.userType === 'admin' && company) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'That company already exists. Join it as an employee instead.',
        { companyName: 'A company with this name already exists.' }
      )
    }

    if (payload.userType === 'employee' && !company) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'The company code is invalid or has expired.',
        { companyCode: 'Enter the current code provided by your company admin.' }
      )
    }

    const companyName =
      payload.userType === 'admin' ? payload.companyName : company!.name

    const supabase = createServerSupabaseClient()
    let createdUser: User

    if (bypassEmail) {
      const { data, error } = await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
      })

      if (error || !data.user) {
        throw new ApiError(400, 'BAD_REQUEST', error?.message ?? 'Unable to create user.')
      }

      createdUser = data.user
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
      })

      if (error || !data.user || data.user.identities?.length === 0) {
        throw new ApiError(400, 'BAD_REQUEST', error?.message ?? 'Unable to create user.')
      }

      createdUser = data.user

      if (data.session) {
        await admin.auth.admin.deleteUser(createdUser.id)
        throw new ApiError(
          500,
          'INTERNAL_ERROR',
          'Email confirmation must be enabled in Supabase before users can sign up.'
        )
      }
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

    if (bypassEmail) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      })

      if (error || !data.session || !data.user?.email) {
        if (payload.userType === 'admin') {
          await admin.from('companies').delete().eq('created_by', createdUser.id)
        }
        await admin.from('users').delete().eq('id', createdUser.id)
        await admin.auth.admin.deleteUser(createdUser.id)
        throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to start the test session.')
      }

      const response = successResponse(
        {
          user: {
            id: createdUser.id,
            email: payload.email,
            companyName,
            userType: payload.userType,
          },
          nextStep: 'complete' as const,
        },
        { status: 201 },
        'Test account created and signed in without email verification.'
      )
      await applySessionCookies(response, data.session)

      return response
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
