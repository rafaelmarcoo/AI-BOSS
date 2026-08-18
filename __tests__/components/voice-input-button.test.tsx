import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoiceInputButton } from '@/components/voice-input-button'

class MockMediaRecorder {
  static isTypeSupported = jest.fn(() => true)
  state: RecordingState = 'inactive'
  mimeType: string
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onstop: ((event: Event) => void) | null = null

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? 'audio/webm'
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({
      data: new Blob(['audio-data'], { type: this.mimeType }),
    } as BlobEvent)
    this.onstop?.(new Event('stop'))
  }
}

describe('VoiceInputButton', () => {
  const originalFetch = global.fetch
  const originalMediaRecorder = global.MediaRecorder
  const stopTrack = jest.fn()
  const getUserMedia = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream)
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.MediaRecorder = originalMediaRecorder
  })

  it('records, transcribes, and returns text for review', async () => {
    const user = userEvent.setup()
    const onTranscript = jest.fn()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { transcript: 'Show my current cash position.' },
      }),
    })
    render(<VoiceInputButton onTranscript={onTranscript} />)

    await user.click(screen.getByRole('button', { name: 'Start voice input' }))
    expect(await screen.findByText('Recording 0:00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop voice recording' }))

    await waitFor(() => {
      expect(onTranscript).toHaveBeenCalledWith('Show my current cash position.')
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/audio/transcribe',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(stopTrack).toHaveBeenCalled()
  })

  it('discards a cancelled recording without transcription', async () => {
    const user = userEvent.setup()
    const onTranscript = jest.fn()
    global.fetch = jest.fn()
    render(<VoiceInputButton onTranscript={onTranscript} />)

    await user.click(screen.getByRole('button', { name: 'Start voice input' }))
    await user.click(screen.getByRole('button', { name: 'Cancel voice recording' }))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(onTranscript).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalled()
  })

  it('explains when microphone permission is denied', async () => {
    const user = userEvent.setup()
    getUserMedia.mockRejectedValueOnce(
      new DOMException('Permission denied', 'NotAllowedError'),
    )
    render(<VoiceInputButton onTranscript={jest.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Start voice input' }))

    expect(
      await screen.findByText('Microphone permission was denied. Allow access and try again.'),
    ).toBeInTheDocument()
  })
})
