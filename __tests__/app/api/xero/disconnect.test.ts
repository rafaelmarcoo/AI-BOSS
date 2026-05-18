/**
 * @jest-environment node
 */

import { POST } from '@/app/api/xero/disconnect/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { createAdminSupabaseClient } from '@/lib/supabase'
import { decryptToken } from '@/lib/xero/crypto'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

jest.mock('@/lib/xero/crypto', () => ({
  decryptToken: jest.fn(),
}))

const mockedRequireAuthenticatedUser =
  requireAuthenticatedUser as jest.MockedFunction<typeof requireAuthenticatedUser>
const mockedCreateAdminSupabaseClient =
  createAdminSupabaseClient as jest.MockedFunction<typeof createAdminSupabaseClient>
const mockedDecryptToken = decryptToken as jest.MockedFunction<typeof decryptToken>

function createQuery(result: unknown) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  }

  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)

  return query
}

function createMutation(result: unknown) {
  const mutation = {
    delete: jest.fn(),
    update: jest.fn(),
    eq: jest.fn().mockResolvedValue(result),
  }

  mutation.delete.mockReturnValue(mutation)
  mutation.update.mockReturnValue(mutation)

  return mutation
}

describe('/api/xero/disconnect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.XERO_CLIENT_ID = 'client-id'
    process.env.XERO_CLIENT_SECRET = 'client-secret'
    mockedRequireAuthenticatedUser.mockResolvedValue({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'owner@example.com',
      },
    })
    mockedDecryptToken.mockResolvedValue('refresh-token')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
    }) as jest.Mock
  })

  it('deletes Xero credentials and soft-disconnects the generic source', async () => {
    const dataConnectionQuery = createQuery({
      data: { id: 'connection-1' },
      error: null,
    })
    const xeroConnectionQuery = createQuery({
      data: { refresh_token_enc: 'encrypted-refresh-token' },
      error: null,
    })
    const deleteMutation = createMutation({ error: null })
    const updateMutation = createMutation({ error: null })

    const from = jest
      .fn()
      .mockReturnValueOnce(dataConnectionQuery)
      .mockReturnValueOnce(xeroConnectionQuery)
      .mockReturnValueOnce(deleteMutation)
      .mockReturnValueOnce(updateMutation)

    mockedCreateAdminSupabaseClient.mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    const response = await POST({} as Parameters<typeof POST>[0])
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toEqual({ disconnected: true })
    expect(from).toHaveBeenNthCalledWith(3, 'xero_connections')
    expect(deleteMutation.eq).toHaveBeenCalledWith(
      'connection_id',
      'connection-1'
    )
    expect(from).toHaveBeenNthCalledWith(4, 'data_connections')
    expect(updateMutation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'disconnected',
        error_message: null,
      })
    )
    expect(updateMutation.eq).toHaveBeenCalledWith('id', 'connection-1')
  })

  it('still disconnects locally when Xero revocation fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Xero down'))

    const dataConnectionQuery = createQuery({
      data: { id: 'connection-1' },
      error: null,
    })
    const xeroConnectionQuery = createQuery({
      data: { refresh_token_enc: 'encrypted-refresh-token' },
      error: null,
    })
    const deleteMutation = createMutation({ error: null })
    const updateMutation = createMutation({ error: null })

    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(dataConnectionQuery)
        .mockReturnValueOnce(xeroConnectionQuery)
        .mockReturnValueOnce(deleteMutation)
        .mockReturnValueOnce(updateMutation),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    const response = await POST({} as Parameters<typeof POST>[0])
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toEqual({ disconnected: true })
    expect(deleteMutation.eq).toHaveBeenCalledWith(
      'connection_id',
      'connection-1'
    )
    expect(updateMutation.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'disconnected' })
    )
  })
})
