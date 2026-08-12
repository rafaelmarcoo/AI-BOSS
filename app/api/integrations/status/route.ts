import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { listProviders } from '@/lib/integrations/registry'
import { createAdminSupabaseClient } from '@/lib/supabase'

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

    const statusMap = new Map((data ?? []).map((row) => [row.provider, row]))
    const statuses = providers.map((provider) => {
      const row = statusMap.get(provider)

      return {
        provider,
        status: row?.status ?? 'available',
        displayName: row?.display_name ?? null,
        connectedAt: row?.connected_at ?? null,
        lastSyncedAt: row?.last_synced_at ?? null,
      }
    })

    return successResponse(statuses)
  } catch (error) {
    return handleRouteError(error)
  }
}
