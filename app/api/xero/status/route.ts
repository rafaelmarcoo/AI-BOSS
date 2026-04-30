import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
//import { createServerSupabaseClient } from '@/lib/supabase'
import { createAdminSupabaseClient } from '@/lib/supabase'

// This route handles GET requests to /api/xero/status
// The XeroConnect component calls this on page load to decide what to show:
// - connected: false → show "Connect to Xero" button
// - connected: true → show tenant name, "Connected" chip and "Disconnect" button
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const supabase = createAdminSupabaseClient()


    // Look up the Xero connection for this user
    const { data: connection } = await supabase
      .from('xero_connections')
      .select('tenant_id, tenant_name, connected_at, expires_at')
      .eq('user_id', user.id)
      .single()


    if (!connection) {
      return successResponse({ connected: false })
    }

    // Row found — return the connection details
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