import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { clearSessionCookies } from '@/lib/auth'
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  createServerSupabaseClient,
} from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const cookieAccessToken = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value
    const cookieRefreshToken = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value

    if (cookieAccessToken && cookieRefreshToken) {
      const supabase = createServerSupabaseClient()
      await supabase.auth.setSession({
        access_token: cookieAccessToken,
        refresh_token: cookieRefreshToken,
      })
      await supabase.auth.signOut()
    }

    const response = successResponse({}, undefined, 'Signed out successfully.')
    clearSessionCookies(response)

    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
