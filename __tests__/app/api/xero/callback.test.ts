/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/xero/callback/route'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@/lib/xero/crypto', () => ({
  encryptToken: jest.fn(),
}))

describe('/api/xero/callback', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })

  it('redirects back to the dashboard origin even when NEXT_PUBLIC_APP_URL contains a path', async () => {
    process.env.NEXT_PUBLIC_APP_URL =
      'https://ai-boss-nine.vercel.app/api/xero/callback'

    const request = new NextRequest(
      'https://ai-boss-nine.vercel.app/api/xero/callback?error=access_denied'
    )

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://ai-boss-nine.vercel.app/dashboard?xero=error'
    )
  })
})
