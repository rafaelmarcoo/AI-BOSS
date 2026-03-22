import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE_ACCESS_TOKEN } from '@/lib/supabase'

const PUBLIC_AUTH_PAGES = ['/sign-in', '/sign-up']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasAccessToken = Boolean(request.cookies.get(COOKIE_ACCESS_TOKEN)?.value)

  if (pathname.startsWith('/dashboard') && !hasAccessToken) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(signInUrl)
  }

  if (PUBLIC_AUTH_PAGES.includes(pathname) && hasAccessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/sign-in', '/sign-up'],
}
