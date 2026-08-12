import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { decryptToken } from '@/lib/xero/crypto'

const XERO_REVOCATION_URL = 'https://identity.xero.com/connect/revocation'

function getXeroClientCredentials() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Xero OAuth environment variables are not configured.'
    )
  }

  return { clientId, clientSecret }
}

function getBasicAuthHeader() {
  const { clientId, clientSecret } = getXeroClientCredentials()

  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const supabase = createAdminSupabaseClient()

    const { data: dataConnection, error: dataConnectionError } = await supabase
      .from('data_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'xero')
      .maybeSingle()

    if (dataConnectionError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load Xero connection.')
    }

    if (!dataConnection) {
      return successResponse({ disconnected: true })
    }

    const { data: connection, error: fetchError } = await supabase
      .from('oauth_tokens')
      .select('refresh_token_enc')
      .eq('connection_id', dataConnection.id)
      .eq('provider', 'xero')
      .maybeSingle()

    if (fetchError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load Xero credentials.')
    }

    try {
      if (!connection) {
        throw new Error('No Xero credentials found to revoke.')
      }

      const refreshToken = await decryptToken(connection.refresh_token_enc)

      await fetch(XERO_REVOCATION_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: getBasicAuthHeader(),
        },
        body: new URLSearchParams({
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      })
    } catch (error) {
      console.error('Xero token revocation failed; deleting local connection.', error)
    }

    const { error: deleteError } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('connection_id', dataConnection.id)
      .eq('provider', 'xero')

    if (deleteError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to disconnect Xero.')
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('data_connections')
      .update({
        status: 'disconnected',
        disconnected_at: now,
        error_message: null,
        updated_at: now,
      })
      .eq('id', dataConnection.id)

    if (updateError) {
      throw new ApiError(
        500,
        'INTERNAL_ERROR',
        'Failed to update Xero connection state.'
      )
    }

    return successResponse(
      { disconnected: true },
      undefined,
      'Xero disconnected successfully.'
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
