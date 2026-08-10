import {
  getOrCreateConversation,
  getCompanyConversation,
  listConversationMessages,
  listUserConversations,
  updateConversationVisibility,
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
    mockedGetUserCompany.mockResolvedValue({
      id: 'company-1',
      name: 'Acme Ltd',
      userType: 'employee',
    })
  })

  it('lists every company-visible conversation for the member company', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      or: jest.fn(),
      order: jest.fn().mockResolvedValue({
        data: [createCompanyConversation()],
        error: null,
      }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.or.mockReturnValue(query)
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    const conversations = await listUserConversations('viewer-1')

    expect(conversations[0]?.user_id).toBe('coworker-1')
    expect(query.eq).toHaveBeenCalledWith('company_id', 'company-1')
    expect(query.or).toHaveBeenCalledWith(
      'user_id.eq.viewer-1,visibility.eq.company'
    )
    expect(query.eq).not.toHaveBeenCalledWith('user_id', 'viewer-1')
  })

  it('allows a member to resolve a coworker conversation in the same company', async () => {
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      or: jest.fn(),
      single: jest.fn().mockResolvedValue({
        data: createCompanyConversation(),
        error: null,
      }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.or.mockReturnValue(query)
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
      or: jest.fn(),
      single: jest.fn().mockResolvedValue({
        data: createCompanyConversation(),
        error: null,
      }),
    }
    conversationQuery.select.mockReturnValue(conversationQuery)
    conversationQuery.eq.mockReturnValue(conversationQuery)
    conversationQuery.or.mockReturnValue(conversationQuery)

    mockedCreateAdminSupabaseClient
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue(messageQuery) } as unknown as ReturnType<typeof createAdminSupabaseClient>)
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue(conversationQuery) } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    const messages = await listConversationMessages('conversation-1', 'viewer-1')

    expect(messages[0]?.user_id).toBe('coworker-1')
    expect(messageQuery.eq).toHaveBeenCalledWith('conversation_id', 'conversation-1')
    expect(messageQuery.eq).not.toHaveBeenCalledWith('user_id', 'viewer-1')
  })

  it('includes admins-only chats for company admins', async () => {
    mockedGetUserCompany.mockResolvedValue({
      id: 'company-1',
      name: 'Acme Ltd',
      userType: 'admin',
    })
    const query = {
      select: jest.fn(),
      eq: jest.fn(),
      or: jest.fn(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.or.mockReturnValue(query)
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await listUserConversations('admin-1')

    expect(query.or).toHaveBeenCalledWith(
      'user_id.eq.admin-1,visibility.in.(company,admins)'
    )
  })

  it('prevents employees from creating admins-only conversations', async () => {
    mockedCreateAdminSupabaseClient.mockReturnValue({} as ReturnType<typeof createAdminSupabaseClient>)

    await expect(
      getOrCreateConversation('employee-1', undefined, 'Secret', 'admins')
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('lets an owner update an existing conversation visibility', async () => {
    const query = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single: jest.fn().mockResolvedValue({
        data: createCompanyConversation({
          user_id: 'employee-1',
          visibility: 'private',
        }),
        error: null,
      }),
    }
    query.update.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.select.mockReturnValue(query)
    mockedCreateAdminSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>)

    await expect(
      updateConversationVisibility('conversation-1', 'employee-1', 'private')
    ).resolves.toMatchObject({ visibility: 'private' })
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'private' })
    )
    expect(query.eq).toHaveBeenCalledWith('user_id', 'employee-1')
  })

  it('prevents an employee changing a conversation to admins-only', async () => {
    mockedCreateAdminSupabaseClient.mockReturnValue({} as ReturnType<typeof createAdminSupabaseClient>)

    await expect(
      updateConversationVisibility('conversation-1', 'employee-1', 'admins')
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})
