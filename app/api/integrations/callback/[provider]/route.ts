import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/responses'
import { consumeOAuthState, storeConnection } from '@/lib/integrations/connections'
import { getAdapter } from '@/lib/integrations/registry'
import { saveAccountingSnapshot } from '@/lib/integrations/sync'

function redirectTo(request: NextRequest, path: string, key: string, provider: string) {
  const redirectUrl = new URL(path, request.nextUrl.origin)
  redirectUrl.searchParams.set(key, provider)
  return NextResponse.redirect(redirectUrl)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const errorParam = request.nextUrl.searchParams.get('error')

  if (errorParam || !code || !state) {
    return redirectTo(request, '/dashboard', 'integration_error', provider)
  }

  try {
    const stateRecord = await consumeOAuthState(state)
    const adapter = getAdapter(provider)

    if (stateRecord.provider !== adapter.provider) {
      return redirectTo(request, stateRecord.redirectPath, 'integration_error', provider)
    }

    const extra: Record<string, string> = {}
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'code' && key !== 'state') extra[key] = value
    })

    const tokens = await adapter.exchangeCodeForTokens(code, state, extra)
    const connectionId = await storeConnection(stateRecord.userId, adapter.provider, tokens)

    try {
      const snapshot = await adapter.getFinancialSnapshot(tokens)
      await saveAccountingSnapshot({
        userId: stateRecord.userId,
        connectionId,
        provider: adapter.provider,
        sourceLabel: tokens.tenantName,
        snapshot,
      })
    } catch (syncError) {
      console.error(`[integrations:${provider}] initial sync failed`, syncError)
    }

    return redirectTo(request, stateRecord.redirectPath, 'integration_connected', provider)
  } catch (error) {
    return handleRouteError(error)
  }
}
