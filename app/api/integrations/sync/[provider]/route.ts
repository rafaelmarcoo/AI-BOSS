import { NextRequest } from 'next/server'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { getValidTokens } from '@/lib/integrations/connections'
import { getAdapter } from '@/lib/integrations/registry'
import { saveAccountingSnapshot } from '@/lib/integrations/sync'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const { user } = await requireAuthenticatedUser(request)
    const adapter = getAdapter(provider)
    const tokens = await getValidTokens(user.id, adapter.provider)
    const snapshot = await adapter.getFinancialSnapshot(tokens)

    await saveAccountingSnapshot({
      userId: user.id,
      connectionId: tokens.connectionId,
      provider: adapter.provider,
      sourceLabel: tokens.tenantName,
      snapshot,
    })

    return successResponse({ provider: adapter.provider, asOf: snapshot.asOf })
  } catch (error) {
    return handleRouteError(error)
  }
}
