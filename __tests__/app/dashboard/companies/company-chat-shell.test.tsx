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

  it('expands to a sidebar and back to a floating window', () => {
    const { container } = renderShell()
    fireEvent.click(screen.getByRole('button', { name: /ask ai-boss/i }))
    const chatWindow = () => container.ownerDocument.querySelector('[data-layout]')!

    expect(chatWindow().getAttribute('data-layout')).toBe('floating')
    fireEvent.click(screen.getByRole('button', { name: 'Expand to a sidebar' }))
    expect(chatWindow().getAttribute('data-layout')).toBe('docked')
    expect(screen.queryByRole('button', { name: 'Minimise chat' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to a floating window' }))
    expect(chatWindow().getAttribute('data-layout')).toBe('floating')
  })

  it('resizes from its edges and remembers the size', () => {
    window.localStorage.clear()
    window.innerHeight = 1000
    const { container } = renderShell()
    fireEvent.click(screen.getByRole('button', { name: /ask ai-boss/i }))
    const chatWindow = () => container.ownerDocument.querySelector('[data-layout]')!

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize chat width' }), { key: 'ArrowLeft' })
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize chat height' }), { key: 'ArrowUp' })

    expect(chatWindow().getAttribute('data-width')).toBe('440')
    expect(chatWindow().getAttribute('data-height')).toBe('660')
    expect(JSON.parse(window.localStorage.getItem('ai-boss.companies-chat-size')!)).toMatchObject({ width: 440, height: 660 })
  })

  it('gets wider when its left edge is dragged left', () => {
    window.localStorage.clear()
    const { container } = renderShell()
    fireEvent.click(screen.getByRole('button', { name: /ask ai-boss/i }))
    const edge = screen.getByRole('separator', { name: 'Resize chat width' })

    fireEvent(edge, new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 400 }))
    fireEvent(window, new MouseEvent('pointermove', { clientX: 400, clientY: 400 }))
    fireEvent(window, new MouseEvent('pointerup', {}))

    expect(container.ownerDocument.querySelector('[data-layout]')!.getAttribute('data-width')).toBe('520')
    expect(document.body.style.userSelect).toBe('')
  })

  it('never shrinks below a usable size', () => {
    window.localStorage.clear()
    const { container } = renderShell()
    fireEvent.click(screen.getByRole('button', { name: /ask ai-boss/i }))
    const widthEdge = screen.getByRole('separator', { name: 'Resize chat width' })

    for (let step = 0; step < 10; step += 1) fireEvent.keyDown(widthEdge, { key: 'ArrowRight' })

    expect(container.ownerDocument.querySelector('[data-layout]')!.getAttribute('data-width')).toBe('340')
  })

  it('greets once, and the greeting can be dismissed', () => {
    renderShell()
    expect(screen.getByText('Hi! 👋')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss greeting' }))
    expect(screen.queryByText('Hi! 👋')).not.toBeInTheDocument()
  })
})
