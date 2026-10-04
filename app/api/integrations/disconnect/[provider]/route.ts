import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { disconnectProviderConnection } from '@/lib/integrations/connections'
import { getAdapter } from '@/lib/integrations/registry'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const { user } = await requireAuthenticatedUser(request)
    const adapter = getAdapter(provider)
    await disconnectProviderConnection(user.id, adapter.provider)

    return successResponse({ disconnected: adapter.provider })
  } catch (error) {
    return handleRouteError(error)
  }
}
