import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandingPage } from '@/app/landing/LandingPage'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
    fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { document: { id: 'document-1', file_name: 'statement.csv' } },
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
      <LandingPage fullName="Rafael Marco" email="rafael@example.com" />,
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
      '.pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

  it('shows upload failures without navigating away', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({ success: true, data: { conversations: [] } }),
    }) as Response)
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: 'Only PDF, CSV, and XLSX uploads are supported.' },
      }),
    }) as Response)
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
})
