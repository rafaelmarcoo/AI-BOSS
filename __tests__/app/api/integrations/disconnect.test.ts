/** @jest-environment node */

import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/integrations/disconnect/[provider]/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { disconnectProviderConnection } from '@/lib/integrations/connections'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/integrations/connections', () => ({
  disconnectProviderConnection: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockDisconnectProviderConnection = jest.mocked(disconnectProviderConnection)

describe('/api/integrations/disconnect/[provider]', () => {
  it('uses the cleanup service before reporting a disconnect', async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'token',
      user: { id: 'user-1', email: 'owner@example.com' },
    })
    mockDisconnectProviderConnection.mockResolvedValue(undefined)

    const response = await DELETE(
      new NextRequest('http://localhost/api/integrations/disconnect/xero', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ provider: 'xero' }) }
    )

    expect(response.status).toBe(200)
    expect(mockDisconnectProviderConnection).toHaveBeenCalledWith('user-1', 'xero')
  })
})
