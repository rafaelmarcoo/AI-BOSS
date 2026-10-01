import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { deactivateConnection } from '@/lib/integrations/connections'
import { getAdapter } from '@/lib/integrations/registry'
import { createAdminSupabaseClient } from '@/lib/supabase'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const { user } = await requireAuthenticatedUser(request)
    const adapter = getAdapter(provider)
    const supabase = createAdminSupabaseClient()

    const { data: connection } = await supabase
      .from('data_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', adapter.provider)
      .maybeSingle()

    await supabase
      .from('oauth_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', adapter.provider)

    if (connection) {
      // Clear this connection's own metric history so the comparison table
      // drops its column immediately — reconnecting fetches a fresh snapshot.
      await supabase
        .from('financial_metric_observations')
        .delete()
        .eq('user_id', user.id)
        .eq('connection_id', connection.id)
    }

    await deactivateConnection(user.id, adapter.provider)

    return successResponse({ disconnected: adapter.provider })
  } catch (error) {
    return handleRouteError(error)
  }
}
