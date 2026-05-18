import { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { successResponse, handleRouteError } from '@/lib/api/responses'
import { deactivateConnection } from '@/lib/integrations/connections'
import type { AccountingProvider } from '@/lib/integrations/types'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const { user } = await requireAuthenticatedUser(request)
    await deactivateConnection(user.id, provider as AccountingProvider)
    return successResponse({ disconnected: provider })
  } catch (err) {
    return handleRouteError(err)
  }
}
