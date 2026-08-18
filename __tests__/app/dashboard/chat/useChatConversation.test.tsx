import { act, renderHook, waitFor } from '@testing-library/react'
import { useChatConversation } from '@/app/dashboard/chat/useChatConversation'

const firstConversation = {
  id: 'conversation-1',
  title: 'Current conversation',
  created_at: '2026-08-18T01:00:00.000Z',
  updated_at: '2026-08-18T03:00:00.000Z',
  visibility: 'company' as const,
  isOwner: true,
}

const secondConversation = {
  id: 'conversation-2',
  title: 'Older conversation',
  created_at: '2026-08-17T01:00:00.000Z',
  updated_at: '2026-08-17T03:00:00.000Z',
  visibility: 'company' as const,
  isOwner: true,
}

describe('useChatConversation deletion', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns to a clean new chat after deleting the active conversation', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/chat/conversations' && !init?.method) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { conversations: [firstConversation, secondConversation] },
          }),
        } as Response
      }

      if (url === `/api/chat/conversations/${firstConversation.id}` && !init?.method) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              conversationId: firstConversation.id,
              conversation: [{ role: 'user', content: 'Show cash.' }],
              visibility: 'company',
              isOwner: true,
            },
          }),
        } as Response
      }

      if (
        url === `/api/chat/conversations/${firstConversation.id}` &&
        init?.method === 'DELETE'
      ) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { deleted: true } }),
        } as Response
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })
    global.fetch = fetchMock

    const { result } = renderHook(() => useChatConversation())

    await waitFor(() => {
      expect(result.current.conversationId).toBe(firstConversation.id)
    })

    await act(async () => {
      await result.current.deleteConversation(firstConversation.id)
    })

    expect(result.current.conversationId).toBeNull()
    expect(result.current.conversationMessages).toEqual([])
    expect(result.current.conversations).toEqual([secondConversation])
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/chat/conversations/${secondConversation.id}`,
      expect.anything(),
    )
  })
})
