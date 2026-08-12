import { randomUUID } from 'node:crypto'
import { ApiError } from '@/lib/api/errors'
import { getAdapter } from '@/lib/integrations/registry'
import type { AccountingProvider, OAuthTokens } from '@/lib/integrations/types'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { decryptToken, encryptToken } from '@/lib/xero/crypto'

const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000
const REFRESH_WINDOW_MS = 5 * 60 * 1000

export async function createOAuthState(
  userId: string,
  provider: AccountingProvider,
  redirectPath = '/dashboard'
) {
  const supabase = createAdminSupabaseClient()
  const state = randomUUID()

  const { error } = await supabase.from('oauth_connection_states').upsert(
    {
      user_id: userId,
      provider,
      state,
      redirect_path: redirectPath,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' }
  )

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to start OAuth connection.')
  }

  return state
}

export async function consumeOAuthState(state: string) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('oauth_connection_states')
    .select('user_id, provider, redirect_path, created_at')
    .eq('state', state)
    .maybeSingle()

  if (error || !data) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid or expired OAuth state.')
  }

  const ageMs = Date.now() - new Date(data.created_at).getTime()
  await supabase.from('oauth_connection_states').delete().eq('state', state)

  if (ageMs > OAUTH_STATE_EXPIRY_MS) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'OAuth state has expired.')
  }

  return {
    userId: data.user_id as string,
    provider: data.provider as AccountingProvider,
    redirectPath: data.redirect_path as string,
  }
}

export async function storeConnection(
  userId: string,
  provider: AccountingProvider,
  tokens: OAuthTokens
) {
  const supabase = createAdminSupabaseClient()
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)
  const now = new Date().toISOString()

  const { data: connection, error: connectionError } = await supabase
    .from('data_connections')
    .upsert(
      {
        user_id: userId,
        provider,
        status: 'connected',
        display_name: tokens.tenantName,
        source_label: providerLabel,
        connected_at: now,
        disconnected_at: null,
        error_message: null,
        metadata: { tenantId: tokens.tenantId },
        updated_at: now,
      },
      { onConflict: 'user_id,provider' }
    )
    .select('id')
    .single()

  if (connectionError || !connection) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save data connection.')
  }

  const { error: tokenError } = await supabase.from('oauth_tokens').upsert(
    {
      connection_id: connection.id,
      user_id: userId,
      provider,
      tenant_id: tokens.tenantId,
      tenant_name: tokens.tenantName,
      access_token_enc: await encryptToken(tokens.accessToken),
      refresh_token_enc: await encryptToken(tokens.refreshToken),
      expires_at: tokens.expiresAt.toISOString(),
      connected_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id,provider' }
  )

  if (tokenError) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save OAuth tokens.')
  }

  return connection.id as string
}

export async function getValidTokens(userId: string, provider: AccountingProvider) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('connection_id, access_token_enc, refresh_token_enc, expires_at, tenant_id, tenant_name')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to load OAuth tokens.')
  }

  if (!data) {
    throw new ApiError(404, 'NOT_FOUND', `No ${provider} connection found for user.`)
  }

  let tokens: OAuthTokens = {
    accessToken: await decryptToken(data.access_token_enc),
    refreshToken: await decryptToken(data.refresh_token_enc),
    expiresAt: new Date(data.expires_at),
    tenantId: data.tenant_id,
    tenantName: data.tenant_name,
  }

  if (tokens.expiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS) {
    const refreshed = await getAdapter(provider).refreshAccessToken(tokens.refreshToken)
    tokens = {
      ...refreshed,
      tenantId: refreshed.tenantId || tokens.tenantId,
      tenantName: refreshed.tenantName || tokens.tenantName,
    }

    const { error: updateError } = await supabase
      .from('oauth_tokens')
      .update({
        access_token_enc: await encryptToken(tokens.accessToken),
        refresh_token_enc: await encryptToken(tokens.refreshToken),
        expires_at: tokens.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', provider)

    if (updateError) {
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to save refreshed OAuth tokens.')
    }
  }

  return { ...tokens, connectionId: data.connection_id as string }
}

export async function findUserByTenant(provider: AccountingProvider, tenantId: string) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('user_id, connection_id')
    .eq('provider', provider)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    userId: data.user_id as string,
    connectionId: data.connection_id as string,
  }
}

export async function deactivateConnection(userId: string, provider: AccountingProvider) {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('data_connections')
    .update({
      status: 'disconnected',
      disconnected_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('user_id', userId)
    .eq('provider', provider)

  if (error) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to disconnect provider.')
  }
}
