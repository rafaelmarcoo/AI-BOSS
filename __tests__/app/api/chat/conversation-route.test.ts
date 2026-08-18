/** @jest-environment node */

import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/chat/conversations/[conversationId]/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { renameConversation } from '@/lib/chat/persistence'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/chat/persistence', () => ({
  deleteConversation: jest.fn(),
  getCompanyConversation: jest.fn(),
  listConversationMessages: jest.fn(),
  mapConversationMessagesToPayload: jest.fn(),
  renameConversation: jest.fn(),
  updateConversationVisibility: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockRenameConversation = jest.mocked(renameConversation)
const context = {
  params: Promise.resolve({ conversationId: 'conversation-1' }),
}

function createPatchRequest(title: string) {
  return new NextRequest(
    'http://localhost/api/chat/conversations/conversation-1',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    },
  )
}

describe('conversation title updates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>)
  })

  it('rejects an empty title before persistence', async () => {
    const response = await PATCH(createPatchRequest('   '), context)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      success: false,
      error: { message: 'Conversation title is required.' },
    })
    expect(mockRenameConversation).not.toHaveBeenCalled()
  })

  it('rejects a title longer than 80 characters before persistence', async () => {
    const response = await PATCH(createPatchRequest('a'.repeat(81)), context)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      success: false,
      error: { message: 'Conversation title must be 80 characters or fewer.' },
    })
    expect(mockRenameConversation).not.toHaveBeenCalled()
  })
})
