import { NextRequest, NextResponse } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.settings.read',
  'accounting.contacts.read',
  'accounting.invoices.read',
  'accounting.reports.profitandloss.read',
  'accounting.reports.balancesheet.read',
  'accounting.banktransactions.read',
].join(' ')

function getXeroOAuthConfig() {
  const clientId = process.env.XERO_CLIENT_ID
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId || !redirectUri) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Xero OAuth environment variables are not configured.'
    )
  }

  return { clientId, redirectUri }
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const { clientId, redirectUri } = getXeroOAuthConfig()
    const state = crypto.randomUUID()
    const supabase = createAdminSupabaseClient()

    const { error } = await supabase.from('xero_oauth_states').upsert(
      {
        user_id: user.id,
        state,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to start Xero OAuth.')
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: XERO_SCOPES,
      state,
    })

    return NextResponse.redirect(`${XERO_AUTH_URL}?${params.toString()}`)
  } catch (error) {
    return handleRouteError(error)
  }
}
