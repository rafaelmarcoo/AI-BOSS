import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { encryptToken } from '@/lib/xero/crypto'

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

function getXeroOAuthConfig() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Xero OAuth environment variables are not configured.')
  }

  return { clientId, clientSecret, redirectUri }
}

function redirectToDashboard(
  request: NextRequest,
  status: 'connected' | 'error' | 'no_tenant'
) {
  const redirectUrl = new URL('/dashboard', request.nextUrl.origin)
  redirectUrl.searchParams.set('xero', status)

  return NextResponse.redirect(redirectUrl)
}

function getBasicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  if (errorParam || !code || !state) {
    return redirectToDashboard(request, 'error')
  }

  try {
    const { user } = await requireAuthenticatedUser(request)
    const { clientId, clientSecret, redirectUri } = getXeroOAuthConfig()
    const supabase = createAdminSupabaseClient()

    const { data: stateRow, error: stateError } = await supabase
      .from('oauth_connection_states')
      .select('state')
      .eq('user_id', user.id)
      .eq('provider', 'xero')
      .eq('state', state)
      .maybeSingle()

    if (stateError || !stateRow) {
      return redirectToDashboard(request, 'error')
    }

    await supabase
      .from('oauth_connection_states')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'xero')

    const tokenResponse = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: getBasicAuthHeader(clientId, clientSecret),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      return redirectToDashboard(request, 'error')
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const connectionsResponse = await fetch(XERO_CONNECTIONS_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!connectionsResponse.ok) {
      return redirectToDashboard(request, 'error')
    }

    const connections = (await connectionsResponse.json()) as Array<{
      tenantId: string
      tenantName: string
    }>
    const tenant = connections[0]

    if (!tenant) {
      return redirectToDashboard(request, 'no_tenant')
    }

    const now = new Date().toISOString()
    const { data: dataConnection, error: dataConnectionError } = await supabase
      .from('data_connections')
      .upsert(
        {
          user_id: user.id,
          provider: 'xero',
          status: 'connected',
          display_name: tenant.tenantName,
          source_label: 'Xero',
          connected_at: now,
          disconnected_at: null,
          error_message: null,
          metadata: { tenantId: tenant.tenantId },
          updated_at: now,
        },
        { onConflict: 'user_id,provider' }
      )
      .select('id')
      .single()

    if (dataConnectionError || !dataConnection) {
      return redirectToDashboard(request, 'error')
    }

    const { error: upsertError } = await supabase
      .from('oauth_tokens')
      .upsert(
        {
          connection_id: dataConnection.id,
          user_id: user.id,
          provider: 'xero',
          tenant_id: tenant.tenantId,
          tenant_name: tenant.tenantName,
          access_token_enc: await encryptToken(tokens.access_token),
          refresh_token_enc: await encryptToken(tokens.refresh_token),
          expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          connected_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id,provider' }
      )

    if (upsertError) {
      return redirectToDashboard(request, 'error')
    }

    return redirectToDashboard(request, 'connected')
  } catch (error) {
    console.error(error)

    return redirectToDashboard(request, 'error')
  }
}
