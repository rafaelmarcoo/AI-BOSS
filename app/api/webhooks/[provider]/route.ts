import { NextRequest, NextResponse } from 'next/server'
import { findUserByTenant, getValidTokens } from '@/lib/integrations/connections'
import { getAdapter } from '@/lib/integrations/registry'
import { saveAccountingSnapshot } from '@/lib/integrations/sync'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  const rawBody = await request.text()
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  let adapter
  try {
    adapter = getAdapter(provider)
  } catch {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  if (!adapter.verifyWebhookSignature(rawBody, headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(rawBody) as unknown
    const event = adapter.parseWebhookEvent(payload)
    if (!event.tenantId) return NextResponse.json({ received: true })

    const owner = await findUserByTenant(adapter.provider, event.tenantId)
    if (!owner) return NextResponse.json({ received: true })

    const tokens = await getValidTokens(owner.userId, adapter.provider)
    const snapshot = await adapter.getFinancialSnapshot(tokens)
    await saveAccountingSnapshot({
      userId: owner.userId,
      connectionId: owner.connectionId,
      provider: adapter.provider,
      sourceLabel: tokens.tenantName,
      snapshot,
    })
  } catch (error) {
    console.error(`[webhooks:${provider}] processing error`, error)
  }

  return NextResponse.json({ received: true })
}
