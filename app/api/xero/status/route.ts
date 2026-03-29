import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
//import { createServerSupabaseClient } from '@/lib/supabase'
import { createAdminSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const supabase = createAdminSupabaseClient()

    console.log('Status check for user:', user.id)

    const { data: connection, error: connError } = await supabase
      .from('xero_connections')
      .select('tenant_id, tenant_name, connected_at, expires_at')
      .eq('user_id', user.id)
      .single()

    console.log('Connection found:', JSON.stringify(connection))
    console.log('Connection error:', JSON.stringify(connError))

    if (!connection) {
      return successResponse({ connected: false })
    }

    return successResponse({
      connected: true,
      tenantId: connection.tenant_id,
      tenantName: connection.tenant_name,
      connectedAt: connection.connected_at,
      expiresAt: connection.expires_at,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}