import { randomUUID } from 'node:crypto'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { encryptToken, decryptToken } from '@/lib/xero/crypto'
import { getAdapter } from './registry'
import type { AccountingProvider, OAuthTokens } from './types'

const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const REFRESH_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

export async function createOAuthState(
  userId: string,
  provider: AccountingProvider,
  redirectPath = '/dashboard'
): Promise<string> {
  const supabase = createAdminSupabaseClient()
  const state = randomUUID()

  const { error } = await supabase.from('oauth_connection_states').upsert(
    { user_id: userId, provider, state, redirect_path: redirectPath, created_at: new Date().toISOString() },
    { onConflict: 'user_id,provider' }
  )

  if (error) throw new Error(`Failed to create OAuth state: ${error.message}`)
  return state
}

export async function consumeOAuthState(
  state: string
): Promise<{ userId: string; provider: AccountingProvider; redirectPath: string }> {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('oauth_connection_states')
    .select('*')
    .eq('state', state)
    .single()

  if (error || !data) throw new Error('Invalid or expired OAuth state')

  const age = Date.now() - new Date(data.created_at).getTime()
  if (age > OAUTH_STATE_EXPIRY_MS) {
    await supabase.from('oauth_connection_states').delete().eq('state', state)
    throw new Error('OAuth state has expired')
  }

  // Delete immediately so it cannot be reused (one-time use)
  await supabase.from('oauth_connection_states').delete().eq('state', state)

  return {
    userId: data.user_id,
    provider: data.provider as AccountingProvider,
    redirectPath: data.redirect_path,
  }
}

export async function storeConnection(
  userId: string,
  provider: AccountingProvider,
  tokens: OAuthTokens
): Promise<string> {
  const supabase = createAdminSupabaseClient()
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1)

  // Upsert the provider-neutral registry row
  const { data: conn, error: connErr } = await supabase
    .from('data_connections')
    .upsert(
      {
        user_id: userId,
        provider,
        status: 'connected',
        display_name: tokens.tenantName,
        source_label: providerLabel,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        error_message: null,
      },
      { onConflict: 'user_id,provider' }
    )
    .select('id')
    .single()

  if (connErr || !conn) {
    throw new Error(`Failed to upsert data_connection: ${connErr?.message}`)
  }

  // Upsert the encrypted token row
  const { error: tokenErr } = await supabase.from('oauth_tokens').upsert(
    {
      connection_id: conn.id,
      user_id: userId,
      provider,
      tenant_id: tokens.tenantId,
      tenant_name: tokens.tenantName,
      access_token_enc: await encryptToken(tokens.accessToken),
      refresh_token_enc: await encryptToken(tokens.refreshToken),
      expires_at: tokens.expiresAt.toISOString(),
    },
    { onConflict: 'user_id,provider' }
  )

  if (tokenErr) throw new Error(`Failed to upsert oauth_tokens: ${tokenErr.message}`)

  return conn.id
}

export async function getValidTokens(
  userId: string,
  provider: AccountingProvider
): Promise<OAuthTokens & { connectionId: string }> {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (error || !data) throw new Error(`No ${provider} connection found for user`)

  let tokens: OAuthTokens = {
    accessToken: await decryptToken(data.access_token_enc),
    refreshToken: await decryptToken(data.refresh_token_enc),
    expiresAt: new Date(data.expires_at),
    tenantId: data.tenant_id,
    tenantName: data.tenant_name,
  }

  const needsRefresh = tokens.expiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS
  if (needsRefresh) {
    const adapter = getAdapter(provider)
    const refreshed = await adapter.refreshAccessToken(tokens.refreshToken)
    tokens = {
      ...refreshed,
      // Preserve tenantId/tenantName — some providers don't return them on refresh
      tenantId: refreshed.tenantId || tokens.tenantId,
      tenantName: refreshed.tenantName || tokens.tenantName,
    }

    await supabase
      .from('oauth_tokens')
      .update({
        access_token_enc: await encryptToken(tokens.accessToken),
        refresh_token_enc: await encryptToken(tokens.refreshToken),
        expires_at: tokens.expiresAt.toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', provider)
  }

  return { ...tokens, connectionId: data.connection_id }
}

export async function findUserByTenant(
  provider: AccountingProvider,
  tenantId: string
): Promise<{ userId: string; connectionId: string } | null> {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('oauth_tokens')
    .select('user_id, connection_id')
    .eq('provider', provider)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) return null
  return { userId: data.user_id, connectionId: data.connection_id }
}

export async function deactivateConnection(
  userId: string,
  provider: AccountingProvider
): Promise<void> {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('data_connections')
    .update({
      status: 'disconnected',
      disconnected_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', provider)

  if (error) throw new Error(`Failed to deactivate connection: ${error.message}`)
}
