/** @jest-environment node */

import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/chat/conversations/[conversationId]/route'
import { requireAuthenticatedUser } from '@/lib/auth'
import { renameConversation, updateConversationModel } from '@/lib/chat/persistence'

jest.mock('@/lib/auth', () => ({
  requireAuthenticatedUser: jest.fn(),
}))

jest.mock('@/lib/chat/persistence', () => ({
  deleteConversation: jest.fn(),
  getCompanyConversation: jest.fn(),
  listConversationMessages: jest.fn(),
  mapConversationMessagesToPayload: jest.fn(),
  renameConversation: jest.fn(),
  updateConversationModel: jest.fn(),
  updateConversationVisibility: jest.fn(),
}))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)
const mockRenameConversation = jest.mocked(renameConversation)
const mockUpdateConversationModel = jest.mocked(updateConversationModel)
const originalOpenAiKey = process.env.OPENAI_API_KEY
const originalGeminiKey = process.env.GEMINI_API_KEY
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

function createModelPatchRequest(selectedModel: string | null) {
  return new NextRequest(
    'http://localhost/api/chat/conversations/conversation-1',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedModel }),
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

  afterEach(() => {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalOpenAiKey
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = originalGeminiKey
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

  it('persists a configured model for the authenticated conversation owner', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockUpdateConversationModel.mockResolvedValue({
      id: 'conversation-1',
      user_id: 'user-1',
      company_id: 'company-1',
      visibility: 'private',
      title: 'Model test',
      selected_model: 'gpt-4o',
      created_at: '2026-10-08T00:00:00.000Z',
      updated_at: '2026-10-08T00:00:00.000Z',
    })

    const response = await PATCH(createModelPatchRequest('gpt-4o'), context)

    expect(response.status).toBe(200)
    expect(mockUpdateConversationModel).toHaveBeenCalledWith(
      'conversation-1',
      'user-1',
      'gpt-4o',
    )
    expect(await response.json()).toMatchObject({
      success: true,
      data: { conversation: { selectedModel: 'gpt-4o' } },
    })
  })

  it('rejects an unconfigured model before changing the conversation', async () => {
    delete process.env.GEMINI_API_KEY

    const response = await PATCH(createModelPatchRequest('gemini-flash'), context)

    expect(response.status).toBe(400)
    expect(mockUpdateConversationModel).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      success: false,
      error: { message: expect.stringContaining('provider is not configured') },
    })
  })
})
