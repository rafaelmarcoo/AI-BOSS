import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { successResponse, handleRouteError } from '@/lib/api/responses'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { listProviders } from '@/lib/integrations/registry'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(request)
    const supabase = createAdminSupabaseClient()
    const providers = listProviders()

    const { data, error } = await supabase
      .from('data_connections')
      .select('provider, status, display_name, connected_at, last_synced_at')
      .eq('user_id', user.id)
      .in('provider', providers)

    if (error) throw error

    const statusMap = Object.fromEntries((data ?? []).map((row) => [row.provider, row]))

    const result = providers.map((provider) => ({
      provider,
      status: statusMap[provider]?.status ?? 'available',
      displayName: statusMap[provider]?.display_name ?? null,
      connectedAt: statusMap[provider]?.connected_at ?? null,
      lastSyncedAt: statusMap[provider]?.last_synced_at ?? null,
    }))

    return successResponse(result)
  } catch (err) {
    return handleRouteError(err)
  }
}
