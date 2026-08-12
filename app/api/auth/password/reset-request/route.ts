import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api/responses'
import { createServerSupabaseClient } from '@/lib/supabase'

const GENERIC_SUCCESS_MESSAGE =
  'If an account exists for that email, a password recovery link has been sent.'

/** Always responds generically so callers cannot discover registered emails. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim() : ''

    if (email) {
      const supabase = createServerSupabaseClient()
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('/reset-password', request.url).toString(),
      })
    }

    return successResponse({ sent: true }, undefined, GENERIC_SUCCESS_MESSAGE)
  } catch (error) {
    // A recovery request must not disclose whether an email exists or whether
    // a provider configuration problem is tied to one specific account.
    console.error('Password recovery request failed.', error)
    return successResponse({ sent: true }, undefined, GENERIC_SUCCESS_MESSAGE)
  }
}
