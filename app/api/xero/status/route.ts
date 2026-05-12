import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const supabase = createAdminSupabaseClient()

    const { data: connection, error } = await supabase
      .from('xero_connections')
      .select('tenant_id, tenant_name, connected_at, expires_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!connection) {
      return successResponse({ connected: false })
    }

    return successResponse({
      connected: true,
      tenantId: connection.tenant_id,
      tenantName: connection.tenant_name,
      connectedAt: connection.connected_at,
      expiresAt: connection.expires_at,
      updatedAt: connection.updated_at,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
