import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { handleRouteError } from '@/lib/api/responses'
import { getAdapter } from '@/lib/integrations/registry'
import { createOAuthState, deactivateConnection } from '@/lib/integrations/connections'
import { createAdminSupabaseClient } from '@/lib/supabase'
import type { AccountingProvider } from '@/lib/integrations/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const { user } = await requireAuthenticatedUser(request)
    const adapter = getAdapter(provider)

    // --- START: Option A — disconnect any other active accounting provider before connecting ---
    const supabase = createAdminSupabaseClient()
    const { data: activeConns } = await supabase
      .from('data_connections')
      .select('provider')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .neq('provider', provider)

    for (const conn of activeConns ?? []) {
      await deactivateConnection(user.id, conn.provider as AccountingProvider)
    }
    // --- END: Option A ---

    const state = await createOAuthState(user.id, provider as AccountingProvider, '/dashboard')
    const authUrl = adapter.getAuthUrl(state)
    return NextResponse.redirect(authUrl)
  } catch (err) {
    return handleRouteError(err)
  }
}
