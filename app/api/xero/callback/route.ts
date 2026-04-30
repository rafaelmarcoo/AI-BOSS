import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { encryptToken } from '@/lib/xero/crypto'

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID!
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI!

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (errorParam || !code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard?xero=error`)
  }

  try {
    const { user } = await requireAuthenticatedUser(request)
    const supabase = createAdminSupabaseClient()

    const { data: stateRow, error: stateError } = await supabase
      .from('xero_oauth_states')
      .select('state')
      .eq('user_id', user.id)
      .eq('state', state)
      .single()

    if (stateError || !stateRow) {
      return NextResponse.redirect(`${appUrl}/dashboard?xero=error`)
    }

    await supabase.from('xero_oauth_states').delete().eq('user_id', user.id)

    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: XERO_REDIRECT_URI,
      }),
    })

    if (!tokenResponse.ok) {
      return NextResponse.redirect(`${appUrl}/dashboard?xero=error`)
    }

    const tokens = await tokenResponse.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const connectionsResponse = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!connectionsResponse.ok) {
      return NextResponse.redirect(`${appUrl}/dashboard?xero=error`)
    }

    const connections = await connectionsResponse.json() as Array<{
      tenantId: string
      tenantName: string
    }>


    const tenant = connections[0]
    if (!tenant) {
      return NextResponse.redirect(`${appUrl}/dashboard?xero=no_tenant`)
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const encryptedAccess = await encryptToken(tokens.access_token)
    const encryptedRefresh = await encryptToken(tokens.refresh_token)

    /*await supabase.from('xero_connections').upsert({
      user_id: user.id,
      tenant_id: tenant.tenantId,
      tenant_name: tenant.tenantName,
      access_token_enc: encryptedAccess,
      refresh_token_enc: encryptedRefresh,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    })

    return NextResponse.redirect(`${appUrl}/dashboard?xero=connected`)*/
    const { error: upsertError } = await supabase.from('xero_connections').upsert({
      user_id: user.id,
      tenant_id: tenant.tenantId,
      tenant_name: tenant.tenantName,
      access_token_enc: encryptedAccess,
      refresh_token_enc: encryptedRefresh,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    })

    // If we can't save the tokens, the connection failed — redirect with error
    if (upsertError) {
      return NextResponse.redirect(`${appUrl}/dashboard?xero=error`)
    }
    return NextResponse.redirect(`${appUrl}/dashboard?xero=connected`)
    
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard?xero=error`)
  }
}