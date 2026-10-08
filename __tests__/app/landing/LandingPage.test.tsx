import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandingPage } from '@/app/landing/LandingPage'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/landing',
}))
jest.mock('@/components/voice-input-button', () => ({
  VoiceInputButton({ onTranscript }: { onTranscript: (value: string) => void }) {
    return (
      <button type="button" onClick={() => onTranscript('show my runway')}>
        Mock voice input
      </button>
    )
  },
}))

describe('LandingPage quick actions', () => {
  const originalFetch = global.fetch
  let fetchMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { document: { id: 'document-1', file_name: 'statement.csv' } },
          }),
        } as Response
      }

      if (String(input) === '/api/activity') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { activities: [] } }),
        } as Response
      }

      if (String(input) === '/api/ai/models') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              models: [
                {
                  id: 'gpt-5.6-luna',
                  label: 'GPT-5.6 Luna',
                  provider: 'OpenAI',
                  description: 'Default model',
                  isDefault: true,
                  available: true,
                },
                {
                  id: 'gpt-4o',
                  label: 'GPT-4o',
                  provider: 'OpenAI',
                  description: 'Fast, with more detail than mini.',
                  isDefault: false,
                  available: true,
                },
              ],
            },
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({ success: true, data: { conversations: [] } }),
      } as Response
    })
    global.fetch = fetchMock
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function renderLandingPage() {
    return render(
      <LandingPage
        fullName="Rafael Marco"
        email="rafael@example.com"
        companyName="Harbour Studio"
      />,
    )
  }

  it('uploads a supported workspace document', async () => {
    const user = userEvent.setup()
    const { container } = renderLandingPage()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['metric,value\ncash,1000'], 'statement.csv', {
      type: 'text/csv',
    })

    expect(input).toHaveAttribute(
      'accept',
      '.pdf,.csv,.xlsx,.txt,.docx,.jpg,.jpeg,.png,.webp,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp',
    )
    await user.upload(input, file)

    expect(
      await screen.findByText('statement.csv was uploaded and is being processed.'),
    ).toBeInTheDocument()
    const uploadCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/documents' && init?.method === 'POST',
    )
    expect(uploadCall).toBeDefined()
    expect((uploadCall?.[1]?.body as FormData).get('file')).toEqual(file)

    await user.click(
      screen.getByRole('button', { name: 'Review extracted data' }),
    )
    expect(mockPush).toHaveBeenCalledWith('/dashboard/documents/document-1')
  })

  it('opens the shared picker from both upload controls', async () => {
    const user = userEvent.setup()
    const { container } = renderLandingPage()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = jest.spyOn(input, 'click')

    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    await user.click(screen.getByRole('button', { name: 'Upload files' }))

    expect(clickSpy).toHaveBeenCalledTimes(2)
  })

  it('shows the welcome header and opens the navigation menu', async () => {
    const user = userEvent.setup()
    renderLandingPage()

    expect(screen.getByRole('link', { name: 'AI-BOSS home' })).toBeInTheDocument()
    expect(screen.getByText('Rafael Marco')).toBeInTheDocument()
    expect(screen.getByText('Harbour Studio')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/landing',
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )

    await user.click(screen.getByRole('button', { name: 'Open profile menu' }))
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/dashboard/settings',
    )
  })

  it('opens the document workspace from Manage documents', async () => {
    renderLandingPage()

    await userEvent.click(
      screen.getByRole('button', { name: 'Manage documents' }),
    )

    expect(mockPush).toHaveBeenCalledWith('/dashboard/documents')
  })

  it('opens the dedicated scenarios workspace', async () => {
    const user = userEvent.setup()
    renderLandingPage()

    await user.click(screen.getByRole('button', { name: 'Scenarios' }))

    expect(mockPush).toHaveBeenCalledWith('/dashboard/scenarios')
  })

  it('shows the recent conversations section at the bottom', async () => {
    renderLandingPage()

    expect(
      screen.getByRole('heading', { name: 'Recent conversations' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('No conversations yet')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/conversations')
  })

  it('shows upload failures without navigating away', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: false,
          json: async () => ({
            success: false,
            error: { message: 'Only PDF, CSV, and XLSX uploads are supported.' },
          }),
        } as Response
      }
      if (String(input) === '/api/activity') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { activities: [] } }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: { conversations: [] } }),
      } as Response
    })
    const { container } = renderLandingPage()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['invalid'], 'notes.txt', { type: 'text/plain' })

    // Direct change exercises server-error handling even though the picker filters types.
    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText('Only PDF, CSV, and XLSX uploads are supported.'),
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('adds a voice transcript to the prompt for review without sending it', async () => {
    const user = userEvent.setup()
    renderLandingPage()

    await user.type(
      screen.getByLabelText('Ask AI-BOSS about your business finances'),
      'Please',
    )
    await user.click(screen.getByRole('button', { name: 'Mock voice input' }))

    expect(screen.getByDisplayValue('Please show my runway')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('carries the selected configured model into a new dashboard chat', async () => {
    const user = userEvent.setup()
    renderLandingPage()

    await user.click(await screen.findByRole('button', { name: 'Model: GPT-5.6 Luna' }))
    await user.click(screen.getByRole('menuitem', { name: /GPT-4o Fast/ }))
    await user.type(
      screen.getByLabelText('Ask AI-BOSS about your business finances'),
      'Show my runway',
    )
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(mockPush).toHaveBeenCalledWith(
      '/dashboard?initialMessage=Show+my+runway&model=gpt-4o',
    )
  })
})
