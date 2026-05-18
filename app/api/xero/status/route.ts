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

    const { data: xeroConnection, error: xeroConnectionError } = await supabase
      .from('xero_connections')
      .select('tenant_id, tenant_name, expires_at, updated_at')
      .eq('connection_id', dataConnection.id)
      .maybeSingle()

    if (xeroConnectionError) {
      throw xeroConnectionError
    }

    if (!xeroConnection) {
      return successResponse({ connected: false })
    }

    return successResponse({
      connected: true,
      tenantId: xeroConnection.tenant_id,
      tenantName: xeroConnection.tenant_name,
      connectedAt: dataConnection.connected_at,
      expiresAt: xeroConnection.expires_at,
      updatedAt: xeroConnection.updated_at,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
