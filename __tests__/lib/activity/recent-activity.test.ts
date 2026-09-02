import { listRecentActivity } from '@/lib/activity/recent-activity'
import { listUserConversations } from '@/lib/chat/persistence'
import { listUserDocuments } from '@/lib/documents/persistence'
import { listSavedScenarios } from '@/lib/scenarios/persistence'

jest.mock('@/lib/chat/persistence', () => ({ listUserConversations: jest.fn() }))
jest.mock('@/lib/documents/persistence', () => ({ listUserDocuments: jest.fn() }))
jest.mock('@/lib/scenarios/persistence', () => ({ listSavedScenarios: jest.fn() }))

const mockListUserConversations = jest.mocked(listUserConversations)
const mockListUserDocuments = jest.mocked(listUserDocuments)
const mockListSavedScenarios = jest.mocked(listSavedScenarios)

describe('listRecentActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListUserDocuments.mockResolvedValue([
      {
        id: 'document-1',
        conversation_id: null,
        file_name: 'cash.xlsx',
        file_type: 'xlsx',
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        status: 'ready',
        financial_review_status: 'pending',
        document_type: null,
        metadata: null,
        error_message: null,
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-28T03:00:00.000Z',
      },
    ])
    mockListUserConversations.mockResolvedValue([
      {
        id: 'conversation-1',
        user_id: 'user-2',
        company_id: 'company-1',
        visibility: 'company',
        title: 'Shared runway review',
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-28T02:00:00.000Z',
      },
    ])
    mockListSavedScenarios.mockResolvedValue([
      {
        id: 'scenario-1',
        user_id: 'user-1',
        company_id: 'company-1',
        name: 'Hiring plan',
        description: null,
        status: 'draft',
        visibility: 'private',
        input_payload: {},
        result_payload: null,
        baseline_fingerprint: [],
        calculated_at: null,
        created_at: '2026-08-27T00:00:00.000Z',
        updated_at: '2026-08-28T01:00:00.000Z',
        isOwner: true,
        isStale: null,
      },
    ])
  })

  it('uses existing owner/company-aware reads and returns newest accessible items', async () => {
    const activities = await listRecentActivity('user-1', 2)

    expect(mockListUserDocuments).toHaveBeenCalledWith('user-1')
    expect(mockListUserConversations).toHaveBeenCalledWith('user-1')
    expect(mockListSavedScenarios).toHaveBeenCalledWith('user-1')
    expect(activities).toEqual([
      expect.objectContaining({
        id: 'document:document-1',
        title: 'Document review required',
        href: '/dashboard/documents/document-1',
      }),
      expect.objectContaining({
        id: 'conversation:conversation-1',
        description: 'Shared runway review',
      }),
    ])
  })

  it('does not return more than the requested boundary', async () => {
    await expect(listRecentActivity('user-1', 0)).resolves.toEqual([])
  })
})
