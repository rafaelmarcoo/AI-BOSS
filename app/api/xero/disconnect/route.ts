import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { ApiError } from '@/lib/api/errors'
//import { createServerSupabaseClient } from '@/lib/supabase'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { decryptToken } from '@/lib/xero/crypto'

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID!
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!

export async function POST(request: NextRequest) {
  try {
    // Verify the user is logged in before doing anything
    const { user } = await requireAuthenticatedUser(request)
    const supabase = createAdminSupabaseClient()

    // Look up the user's Xero connection in Supabase
    // We only need the refresh_token_enc column — the encrypted refresh token
    // We need this to tell Xero to invalidate the token on their side
    const { data: connection, error: fetchError } = await supabase
      .from('xero_connections')
      .select('refresh_token_enc')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !connection) {
      throw new ApiError(404, 'NOT_FOUND', 'No Xero connection found.')
    }

    // This inner try/catch is intentionally separate from the outer one.
    // We want to attempt token revocation with Xero but NOT let it block
    // the database cleanup if it fails. The user should always be able to disconnect
    // even if Xero's revocation endpoint is down or the token is already expired.
    try {
      const refreshToken = await decryptToken(connection.refresh_token_enc)

      // Tell Xero to invalidate this token — best practice per OAuth 2.0 RFC 7009
      // This means even if someone had intercepted the token, it's now useless
      // We authenticate our app using Basic auth (Base64 encoded clientId:clientSecret)
      await fetch('https://identity.xero.com/connect/revocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      })
    } catch (err) {
      // Log but continue — always clean up DB even if Xero revocation fails
      console.error('Token revocation failed:', err)
    }

    // Delete the connection row from our database
    const { error: deleteError } = await supabase
      .from('xero_connections')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to disconnect Xero.')
    }

    return successResponse({ disconnected: true }, undefined, 'Xero disconnected successfully.')
  } catch (error) {
    return handleRouteError(error)
  }
}