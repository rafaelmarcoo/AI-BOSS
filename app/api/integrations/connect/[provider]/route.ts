import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createOAuthState } from '@/lib/integrations/connections'
import { getAdapter } from '@/lib/integrations/registry'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params
    const { user } = await requireAuthenticatedUser(request)
    const adapter = getAdapter(provider)
    const redirectPath = request.nextUrl.searchParams.get('redirect') ?? '/dashboard'
    const state = await createOAuthState(user.id, adapter.provider, redirectPath)

    return NextResponse.redirect(adapter.getAuthUrl(state))
  } catch (error) {
    return handleRouteError(error)
  }
}
