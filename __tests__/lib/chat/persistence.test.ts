import {
  getCompanyConversation,
  listConversationMessages,
  listUserConversations,
} from '@/lib/chat/persistence'
import { getUserCompany } from '@/lib/companies'
import { createAdminSupabaseClient } from '@/lib/supabase'

jest.mock('@/lib/companies', () => ({ getUserCompany: jest.fn() }))
jest.mock('@/lib/supabase', () => ({ createAdminSupabaseClient: jest.fn() }))

const mockedGetUserCompany = getUserCompany as jest.MockedFunction<typeof getUserCompany>
const mockedCreateAdminSupabaseClient =
  createAdminSupabaseClient as jest.MockedFunction<typeof createAdminSupabaseClient>

function createCompanyConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    user_id: 'coworker-1',
    company_id: 'company-1',
    visibility: 'company',
    title: 'Shared forecast',
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('company conversation persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetUserCompany.mockResolvedValue({ id: 'company-1', name: 'Acme Ltd' })
  })

  it('lists every company-visible conversation for the member company', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({
        data: [createCompanyConversation()],
        error: null,
      }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    const conversations = await listUserConversations('viewer-1')

    expect(conversations[0]?.user_id).toBe('coworker-1')
    expect(query.eq).toHaveBeenCalledWith('company_id', 'company-1')
    expect(query.eq).toHaveBeenCalledWith('visibility', 'company')
    expect(query.eq).not.toHaveBeenCalledWith('user_id', 'viewer-1')
  })

  it('allows a member to resolve a coworker conversation in the same company', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn().mockResolvedValue({
        data: createCompanyConversation(),
        error: null,
      }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await expect(getCompanyConversation('conversation-1', 'viewer-1')).resolves.toMatchObject({
      user_id: 'coworker-1',
      company_id: 'company-1',
    })
  })

  it('loads all messages after company access is verified', async () => {
    const messageQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn().mockResolvedValue({
        data: [{
          id: 'message-1',
          conversation_id: 'conversation-1',
          user_id: 'coworker-1',
          role: 'user',
          content: 'Shared message',
          citations: null,
          ui_payload: null,
          created_at: '2026-08-10T00:00:00.000Z',
        }],
        error: null,
      }),
    }
    messageQuery.select.mockReturnValue(messageQuery)
    messageQuery.eq.mockReturnValue(messageQuery)

    const conversationQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn().mockResolvedValue({
        data: createCompanyConversation(),
        error: null,
      }),
    }
    conversationQuery.select.mockReturnValue(conversationQuery)
    conversationQuery.eq.mockReturnValue(conversationQuery)

    mockedCreateAdminSupabaseClient
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue(messageQuery) } as unknown as ReturnType<typeof createAdminSupabaseClient>)
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue(conversationQuery) } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    const messages = await listConversationMessages('conversation-1', 'viewer-1')

    expect(messages[0]?.user_id).toBe('coworker-1')
    expect(messageQuery.eq).toHaveBeenCalledWith('conversation_id', 'conversation-1')
    expect(messageQuery.eq).not.toHaveBeenCalledWith('user_id', 'viewer-1')
  })
})
