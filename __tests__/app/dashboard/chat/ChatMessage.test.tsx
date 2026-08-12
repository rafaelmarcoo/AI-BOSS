import { render, screen } from '@testing-library/react'

jest.mock('react-markdown', () => ({
  __esModule: true,
  default({ children }: { children: string }) {
    return (
      <>
        {children
          .replace(/\*\*/g, '')
          .split('\n')
          .filter(Boolean)
          .map((line) => (
            <div key={line}>{line.replace(/^- /, '')}</div>
          ))}
      </>
    )
  },
}))

import { ChatMessage } from '@/app/dashboard/chat/ChatMessage'

describe('ChatMessage', () => {
  it('renders assistant markdown lists and bold text', () => {
    render(
      <ChatMessage
        role="assistant"
        content={'**Runway**\n\n- Cash is available\n- Burn is rising'}
      />
    )

    expect(screen.getByText('Runway')).toBeInTheDocument()
    expect(screen.getByText('Cash is available')).toBeInTheDocument()
    expect(screen.getByText('Burn is rising')).toBeInTheDocument()
  })

  it('keeps user markdown literal', () => {
    render(<ChatMessage role="user" content={'**not bold**\n- not a list'} />)

    expect(screen.getByText('**not bold** - not a list')).toBeInTheDocument()
  })
})
