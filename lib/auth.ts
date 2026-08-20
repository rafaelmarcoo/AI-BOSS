import { NextRequest, NextResponse } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_MAGIC_LINK_STATE,
  COOKIE_REFRESH_TOKEN,
  COOKIE_SIGNUP_STATE,
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

export function applyPendingSignInCookie(response: NextResponse, email: string) {
  applyPendingEmailCookie(response, COOKIE_MAGIC_LINK_STATE, email)
}

export function getPendingSignInEmail(request: NextRequest) {
  return getPendingEmail(request, COOKIE_MAGIC_LINK_STATE)
}

export function applyPendingSignUpCookie(response: NextResponse, email: string) {
  applyPendingEmailCookie(response, COOKIE_SIGNUP_STATE, email)
}

export function getPendingSignUpEmail(request: NextRequest) {
  return getPendingEmail(request, COOKIE_SIGNUP_STATE)
}

function applyPendingEmailCookie(
  response: NextResponse,
  cookieName: string,
  email: string
) {
  response.cookies.set(
    cookieName,
    Buffer.from(email.toLowerCase(), 'utf8').toString('base64url'),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    }
  )
}

function getPendingEmail(request: NextRequest, cookieName: string) {
  const value = request.cookies.get(cookieName)?.value
  if (!value) return null

  try {
    const email = Buffer.from(value, 'base64url').toString('utf8').trim().toLowerCase()
    return email || null
  } catch {
    return null
  }
}
