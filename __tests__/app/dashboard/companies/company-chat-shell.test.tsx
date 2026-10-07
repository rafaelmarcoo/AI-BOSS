import { fireEvent, render, screen } from '@testing-library/react'
import { CompanyChatShell, useCompanyChat } from '@/app/dashboard/companies/CompanyChatShell'

jest.mock('@/app/dashboard/chat/sidebar', () => ({
  ChatSidebar: ({ selectionPrompt }: { selectionPrompt?: { text: string } | null }) => (
    <div data-testid="chat">{selectionPrompt ? `asked: ${selectionPrompt.text}` : 'chat ready'}</div>
  ),
}))

function ExplainButton() {
  const { ask } = useCompanyChat()
  return <button onClick={() => ask('Compare Ressett with Fixxupp')}>Explain this in chat</button>
}

function renderShell() {
  return render(
    <CompanyChatShell fullName="Test" email="test@example.com" userType={null}>
      <ExplainButton />
    </CompanyChatShell>
  )
}

describe('CompanyChatShell', () => {
  it('opens the chat on the page from the Ask AI-BOSS button', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /ask ai-boss/i }))

    expect(screen.getByText('Ask about these companies')).toBeVisible()
    expect(screen.getByTestId('chat')).toHaveTextContent('chat ready')
  })

  it('sends "Explain this in chat" to the chat drawer instead of leaving the page', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Explain this in chat' }))

    expect(screen.getByText('Ask about these companies')).toBeVisible()
    expect(screen.getByTestId('chat')).toHaveTextContent('asked: Compare Ressett with Fixxupp')
  })

  it('closes the drawer and brings the Ask AI-BOSS button back', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /ask ai-boss/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }))

    expect(screen.getByRole('button', { name: /ask ai-boss/i })).toBeInTheDocument()
  })

  it('asks a suggested question when its chip is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /ask ai-boss/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Ressett with Fixxupp' }))

    expect(screen.getByTestId('chat')).toHaveTextContent('asked: Compare Ressett with Fixxupp')
  })

  it('swaps the suggestions for follow-ups once one is asked', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: /ask ai-boss/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare Ressett with Fixxupp' }))

    expect(screen.queryByRole('button', { name: 'Compare Ressett with Fixxupp' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Which of Ressett and Fixxupp keeps more of each sale?' })).toBeInTheDocument()
    expect(screen.getByText('Ask next')).toBeInTheDocument()
  })

  it('greets once, and the greeting can be dismissed', () => {
    renderShell()
    expect(screen.getByText('Hi! 👋')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss greeting' }))
    expect(screen.queryByText('Hi! 👋')).not.toBeInTheDocument()
  })
})
