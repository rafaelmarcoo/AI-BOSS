import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { clearSessionCookies, requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase'

function readPassword(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be at least 8 characters long.`)
  }

  return value
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const body = (await request.json()) as {
      currentPassword?: unknown
      newPassword?: unknown
    }
    const currentPassword = readPassword(body.currentPassword, 'Current password')
    const newPassword = readPassword(body.newPassword, 'New password')

    if (currentPassword === newPassword) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Choose a new password that differs from the current password.')
    }

    const supabase = createServerSupabaseClient()
    const { error: verificationError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (verificationError) {
      throw new ApiError(401, 'AUTH_INVALID', 'Your current password is incorrect.')
    }

    const admin = createAdminSupabaseClient()
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    if (updateError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Could not update your password.')
    }

    const response = successResponse(
      { changed: true },
      undefined,
      'Password updated. Please sign in again.'
    )
    clearSessionCookies(response)
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
