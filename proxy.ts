import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE_ACCESS_TOKEN } from '@/lib/supabase'

const PUBLIC_AUTH_PAGES = [
  '/sign-in',
  '/sign-up',
  '/verify-email',
  '/check-email',
  '/auth/callback',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value
  const isProtectedPage =
    pathname.startsWith('/dashboard') || pathname.startsWith('/landing')

  if (isProtectedPage && !accessToken) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  if (PUBLIC_AUTH_PAGES.includes(pathname) && accessToken) {
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/landing/:path*',
    '/sign-in',
    '/sign-up',
    '/verify-email',
    '/check-email',
    '/auth/callback',
  ],
}
