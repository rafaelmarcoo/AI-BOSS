import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { getDemoXeroStatus, isXeroDemoMode } from '@/lib/xero/demo'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)

    if (isXeroDemoMode()) {
      return successResponse(getDemoXeroStatus())
    }

    const supabase = createAdminSupabaseClient()

    const { data: dataConnection, error: dataConnectionError } = await supabase
      .from('data_connections')
      .select('id, status, connected_at')
      .eq('user_id', user.id)
      .eq('provider', 'xero')
      .maybeSingle()

    if (dataConnectionError) {
      throw dataConnectionError
    }

    if (!dataConnection || dataConnection.status !== 'connected') {
      return successResponse({ connected: false })
    }

    const { data: oauthToken, error: oauthTokenError } = await supabase
      .from('oauth_tokens')
      .select('tenant_id, tenant_name, expires_at, updated_at')
      .eq('connection_id', dataConnection.id)
      .eq('provider', 'xero')
      .maybeSingle()

    if (oauthTokenError) {
      throw oauthTokenError
    }

    if (!oauthToken) {
      return successResponse({ connected: false })
    }

    return successResponse({
      connected: true,
      tenantId: oauthToken.tenant_id,
      tenantName: oauthToken.tenant_name,
      connectedAt: dataConnection.connected_at,
      expiresAt: oauthToken.expires_at,
      updatedAt: oauthToken.updated_at,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
