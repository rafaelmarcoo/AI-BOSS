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

    const { data: connection, error: fetchError } = await supabase
      .from('xero_connections')
      .select('refresh_token_enc')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load Xero connection.')
    }

    if (!connection) {
      return successResponse({ disconnected: true })
    }

    try {
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
      .from('xero_connections')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to disconnect Xero.')
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
