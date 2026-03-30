import { ApiError } from '@/lib/api/errors'
import { ChatMessagePayload } from '@/lib/api/validation'
import { CHAT_MODEL, CHAT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'

interface OpenAIChatCompletionResponse {
  model?: string
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  usage?: {
    total_tokens?: number
  }
}

export async function createOpenAIChatCompletion(
  messages: ChatMessagePayload[]
) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: CHAT_SYSTEM_PROMPT,
        },
        ...messages,
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()

    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'OpenAI request failed.',
      errorBody
    )
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse
  const content = data.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'OpenAI returned an empty response.'
    )
  }

  return {
    content,
    model: data.model ?? CHAT_MODEL,
    tokensUsed: data.usage?.total_tokens ?? null,
  }
}
