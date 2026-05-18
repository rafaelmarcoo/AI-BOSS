import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { decryptToken, encryptToken } from '@/lib/xero/crypto'

const REFRESH_WINDOW_MS = 5 * 60 * 1000
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'

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

export async function getValidXeroToken(userId: string) {
  const supabase = createAdminSupabaseClient()
  const { data: dataConnection, error: dataConnectionError } = await supabase
    .from('data_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'xero')
    .eq('status', 'connected')
    .maybeSingle()

  if (dataConnectionError) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load Xero connection.')
  }

  if (!dataConnection) {
    throw new ApiError(404, 'NOT_FOUND', 'No connected Xero source found for user.')
  }

  const { data: connection, error } = await supabase
    .from('oauth_tokens')
    .select('access_token_enc, refresh_token_enc, expires_at')
    .eq('connection_id', dataConnection.id)
    .eq('provider', 'xero')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load Xero connection.')
  }

  if (!connection) {
    throw new ApiError(404, 'NOT_FOUND', 'No Xero connection found for user.')
  }

  const expiresAt = new Date(connection.expires_at)
  const needsRefresh = expiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS

  if (!needsRefresh) {
    return decryptToken(connection.access_token_enc)
  }

  const refreshToken = await decryptToken(connection.refresh_token_enc)
  const response = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to refresh Xero token.')
  }

  const tokens = (await response.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const { error: updateError } = await supabase
    .from('oauth_tokens')
    .update({
      access_token_enc: await encryptToken(tokens.access_token),
      refresh_token_enc: await encryptToken(tokens.refresh_token),
      expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq('connection_id', dataConnection.id)
    .eq('provider', 'xero')

  if (updateError) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Failed to save refreshed Xero token.'
    )
  }

  return tokens.access_token
}
