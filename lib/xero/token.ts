import { ApiError } from '@/lib/api/errors'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { encryptToken, decryptToken } from '@/lib/xero/crypto'

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID!
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!

export async function getValidXeroToken(userId: string): Promise<string> {
  // Using admin client here since this is a server-side helper
  // called from other API routes where we already verified auth
  const supabase = createAdminSupabaseClient()

  // Fetch the stored connection for this user
  const { data: connection, error } = await supabase
    .from('xero_connections')
    .select('access_token_enc, refresh_token_enc, expires_at')
    .eq('user_id', userId)
    .single()

  // If no connection found the user hasn't connected Xero yet
  // or they disconnected — throw a 404 so the route can handle it
  if (error || !connection) {
    throw new ApiError(404, 'NOT_FOUND', 'No Xero connection found for user.')
  }

  // Convert the stored expiry timestamp string into a JavaScript Date object
  // so we can do time arithmetic on it
  const expiresAt = new Date(connection.expires_at)
  const now = new Date()

  // Check if the token expires within the next 5 minutes
  // getTime() returns milliseconds so we convert 5 minutes to milliseconds
  // 5 * 60 * 1000 = 5 minutes * 60 seconds * 1000 milliseconds = 300,000ms
  // We refresh proactively rather than waiting for it to actually expire
  // This prevents API calls failing mid-request because the token just expired
  const needsRefresh = expiresAt.getTime() - now.getTime() < 5 * 60 * 1000

  if (!needsRefresh) {
    return decryptToken(connection.access_token_enc)
  }

  // Token is expired or about to expire — use the refresh token to get a new one
  const refreshToken = await decryptToken(connection.refresh_token_enc)

  // Call Xero's token endpoint with grant_type: refresh_token
  // This is the standard OAuth 2.0 refresh token flow
  // Xero returns a brand new access token and refresh token
  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  // If refresh failed the user probably needs to reconnect
  // This can happen if the refresh token expired (after 60 days of no use)
  if (!response.ok) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to refresh Xero token.')
  }

  const tokens = await response.json() as {
    access_token: string // new access token, valid for 30 minutes
    refresh_token: string
    expires_in: number
  }

  // Calculate when the new access token will expire as an ISO timestamp
  // Date.now() = current time in milliseconds
  // expires_in is in seconds so multiply by 1000 to convert to milliseconds
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const encryptedAccess = await encryptToken(tokens.access_token)
  const encryptedRefresh = await encryptToken(tokens.refresh_token)

  const { error: updateError } = await supabase
    .from('xero_connections')
    .update({
      access_token_enc: encryptedAccess,
      refresh_token_enc: encryptedRefresh,
      expires_at: newExpiresAt,
    })
    .eq('user_id', userId)
  
  // If we can't save the new tokens, throw so the calling route knows
  if (updateError) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save refreshed Xero tokens.')
   }

  return tokens.access_token

}