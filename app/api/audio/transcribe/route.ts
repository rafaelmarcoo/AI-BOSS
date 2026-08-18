import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/api/errors'
import { handleRouteError, successResponse } from '@/lib/api/responses'
import { requireAuthenticatedUser } from '@/lib/auth'

export const runtime = 'nodejs'

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024
const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
])

function extensionForAudioType(type: string) {
  if (type === 'audio/mp4') return 'mp4'
  if (type === 'audio/mpeg') return 'mp3'
  if (type === 'audio/ogg') return 'ogg'
  if (type === 'audio/wav') return 'wav'
  if (type === 'audio/x-m4a') return 'm4a'
  return 'webm'
}

function validateAudio(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    throw new ApiError(400, 'BAD_REQUEST', 'A non-empty audio recording is required.')
  }

  const normalizedType = value.type.toLowerCase().split(';')[0]

  if (!SUPPORTED_AUDIO_TYPES.has(normalizedType)) {
    throw new ApiError(400, 'BAD_REQUEST', 'This audio format is not supported.')
  }

  if (value.size > MAX_AUDIO_SIZE_BYTES) {
    throw new ApiError(400, 'BAD_REQUEST', 'The recording exceeds the 25 MB safety limit.')
  }

  return { file: value, normalizedType }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser(request)
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new ApiError(
        503,
        'INTERNAL_ERROR',
        'Voice transcription is not configured right now.'
      )
    }

    const requestFormData = await request.formData()
    const { file, normalizedType } = validateAudio(requestFormData.get('audio'))
    const openAiFormData = new FormData()
    const extension = extensionForAudioType(normalizedType)

    openAiFormData.set(
      'file',
      new File([await file.arrayBuffer()], `recording.${extension}`, {
        type: normalizedType,
      })
    )
    openAiFormData.set(
      'model',
      process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe'
    )

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openAiFormData,
    })

    if (!response.ok) {
      console.error('OpenAI transcription request failed.', {
        status: response.status,
      })
      throw new ApiError(
        502,
        'INTERNAL_ERROR',
        'The recording could not be transcribed right now.'
      )
    }

    const payload = (await response.json()) as { text?: unknown }
    const transcript = typeof payload.text === 'string' ? payload.text.trim() : ''

    if (!transcript) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'No speech could be detected in the recording.'
      )
    }

    return successResponse({ transcript })
  } catch (error) {
    return handleRouteError(error)
  }
}
