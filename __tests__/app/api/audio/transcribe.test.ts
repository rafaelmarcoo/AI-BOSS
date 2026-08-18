/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/audio/transcribe/route'
import { requireAuthenticatedUser } from '@/lib/auth'

jest.mock('@/lib/auth', () => ({ requireAuthenticatedUser: jest.fn() }))

const mockRequireAuthenticatedUser = jest.mocked(requireAuthenticatedUser)

function createRequest(file: File) {
  const formData = new FormData()
  formData.set('audio', file)

  return new NextRequest('http://localhost/api/audio/transcribe', {
    method: 'POST',
    body: formData,
  })
}

describe('/api/audio/transcribe', () => {
  const originalApiKey = process.env.OPENAI_API_KEY
  const originalModel = process.env.OPENAI_TRANSCRIPTION_MODEL
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-api-key'
    delete process.env.OPENAI_TRANSCRIPTION_MODEL
    mockRequireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof requireAuthenticatedUser>>)
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalApiKey
    if (originalModel === undefined) delete process.env.OPENAI_TRANSCRIPTION_MODEL
    else process.env.OPENAI_TRANSCRIPTION_MODEL = originalModel
  })

  it('forwards browser WebM audio and returns only the transcript', async () => {
    const upstreamFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '  Forecast my cash for six months.  ' }),
    })
    global.fetch = upstreamFetch

    const response = await POST(
      createRequest(new File(['audio-data'], 'voice.webm', { type: 'audio/webm' })),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      data: { transcript: 'Forecast my cash for six months.' },
    })
    expect(upstreamFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-api-key' },
      }),
    )
    const upstreamBody = upstreamFetch.mock.calls[0]?.[1]?.body as FormData
    expect(upstreamBody.get('model')).toBe('gpt-4o-mini-transcribe')
    expect(upstreamBody.get('file')).toBeInstanceOf(File)
  })

  it('rejects unsupported audio before contacting OpenAI', async () => {
    const upstreamFetch = jest.fn()
    global.fetch = upstreamFetch

    const response = await POST(
      createRequest(new File(['text'], 'notes.txt', { type: 'text/plain' })),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      success: false,
      error: { message: 'This audio format is not supported.' },
    })
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('does not expose upstream error details', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 })
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await POST(
      createRequest(new File(['audio-data'], 'voice.mp4', { type: 'audio/mp4' })),
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      success: false,
      error: { message: 'The recording could not be transcribed right now.' },
    })
    expect(consoleError).toHaveBeenCalledWith(
      'OpenAI transcription request failed.',
      { status: 429 },
    )
    consoleError.mockRestore()
  })
})
