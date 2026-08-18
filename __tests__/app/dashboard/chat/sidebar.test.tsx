import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatSidebar } from '@/app/dashboard/chat/sidebar'
import { useChatConversation } from '@/app/dashboard/chat/useChatConversation'
import { useDocuments } from '@/app/dashboard/chat/useDocuments'

jest.mock('react-markdown', () => ({
  __esModule: true,
  default({ children }: { children: string }) {
    return <>{children}</>
  },
}))
jest.mock('@/app/dashboard/chat/useChatConversation')
jest.mock('@/app/dashboard/chat/useDocuments')

const mockUseChatConversation = jest.mocked(useChatConversation)
const mockUseDocuments = jest.mocked(useDocuments)

const ownedConversation = {
  id: 'conversation-1',
  title: 'Historical Cash Trend',
  created_at: '2026-08-18T01:00:00.000Z',
  updated_at: '2026-08-18T02:00:00.000Z',
  visibility: 'company' as const,
  isOwner: true,
}

function setupConversation(overrides: Record<string, unknown> = {}) {
  const renameConversation = jest.fn().mockResolvedValue(undefined)
  const deleteConversation = jest.fn().mockResolvedValue(undefined)

  mockUseChatConversation.mockReturnValue({
    conversationId: ownedConversation.id,
    isReadOnly: false,
    visibility: 'company',
    changeVisibility: jest.fn().mockResolvedValue(undefined),
    conversationMessages: [],
    activeGenUiPlan: null,
    conversations: [ownedConversation],
    historyLoading: false,
    loading: false,
    error: null,
    sendMessage: jest.fn().mockResolvedValue(undefined),
    retryMessage: jest.fn().mockResolvedValue(undefined),
    selectConversation: jest.fn().mockResolvedValue(undefined),
    startNewConversation: jest.fn(),
    renameConversation,
    deleteConversation,
    ...overrides,
  })
  mockUseDocuments.mockReturnValue({
    documents: [],
    documentsLoading: false,
    uploading: false,
    documentsError: null,
    uploadDocument: jest.fn().mockResolvedValue(undefined),
    refreshDocuments: jest.fn(),
  })

  render(
    <ChatSidebar
      fullName="Rafael"
      email="rafael@example.com"
      userType="admin"
    />,
  )

  return { renameConversation, deleteConversation }
}

describe('ChatSidebar conversation management', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renames the current owned conversation from its header menu', async () => {
    const user = userEvent.setup()
    const { renameConversation } = setupConversation()

    await user.click(
      screen.getByRole('button', { name: 'Manage current conversation' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))

    const input = screen.getByPlaceholderText('Conversation name')
    await user.clear(input)
    await user.type(input, 'Six-month cash outlook')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(renameConversation).toHaveBeenCalledWith(
        ownedConversation.id,
        'Six-month cash outlook',
      )
    })
    expect(await screen.findByText('Conversation renamed.')).toBeInTheDocument()
  })

  it('requires confirmation before permanently deleting a conversation', async () => {
    const user = userEvent.setup()
    const { deleteConversation } = setupConversation()

    await user.click(
      screen.getByRole('button', { name: 'Manage current conversation' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(
      screen.getByText(/Delete “Historical Cash Trend”\? This permanently removes/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteConversation).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(
      screen.getByRole('button', { name: 'Manage current conversation' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await user.click(
      screen.getByRole('button', { name: 'Delete permanently' }),
    )

    await waitFor(() => {
      expect(deleteConversation).toHaveBeenCalledWith(ownedConversation.id)
    })
    expect(await screen.findByText('Conversation deleted.')).toBeInTheDocument()
  })

  it('does not offer management actions for a coworker conversation', async () => {
    const coworkerConversation = { ...ownedConversation, isOwner: false }
    setupConversation({
      isReadOnly: true,
      conversations: [coworkerConversation],
    })

    expect(
      screen.queryByRole('button', { name: 'Manage current conversation' }),
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open conversation history' }))
    expect(
      screen.queryByRole('button', { name: /Manage Historical Cash Trend/ }),
    ).not.toBeInTheDocument()
  })
})
