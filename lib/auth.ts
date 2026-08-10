import { NextRequest, NextResponse } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  createAdminSupabaseClient,
  createServerSupabaseClient,
} from '@/lib/supabase'

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface AuthenticatedUser {
  id: string
  email: string
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

export function getAccessTokenFromRequest(request: NextRequest) {
  return getBearerToken(request) ?? request.cookies.get(COOKIE_ACCESS_TOKEN)?.value ?? null
}

export async function getAuthenticatedUser(
  accessToken: string
): Promise<AuthenticatedUser> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error || !data.user?.email) {
    throw new ApiError(401, 'AUTH_INVALID', 'The provided access token is invalid.')
  }

  return {
    id: data.user.id,
    email: data.user.email,
  }
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const accessToken = getAccessTokenFromRequest(request)

  if (!accessToken) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  }

  const user = await getAuthenticatedUser(accessToken)

  return {
    accessToken,
    user,
  }
}

export async function getCurrentUserProfile(accessToken: string) {
  const user = await getAuthenticatedUser(accessToken)
  const admin = createAdminSupabaseClient()
  const { data: profile, error } = await admin
    .from('users')
    .select('id, email, full_name, company_name, user_type, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load user profile.')
  }

  return {
    user,
    profile,
  }
}

export async function applySessionCookies(
  response: NextResponse,
  session: {
    access_token: string
    refresh_token: string
    expires_in?: number
  }
) {
  const accessTokenMaxAge = session.expires_in ?? ACCESS_TOKEN_MAX_AGE_SECONDS

  response.cookies.set(COOKIE_ACCESS_TOKEN, session.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: accessTokenMaxAge,
  })
  response.cookies.set(COOKIE_REFRESH_TOKEN, session.refresh_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  })
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(COOKIE_ACCESS_TOKEN)
  response.cookies.delete(COOKIE_REFRESH_TOKEN)
}
