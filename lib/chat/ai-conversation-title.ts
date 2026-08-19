import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { UTILITY_MODEL } from '@/lib/ai/model-config'

export const MAX_AI_CONVERSATION_TITLE_LENGTH = 48

function modelContentToText(content: AIMessage['content']) {
  return typeof content === 'string' ? content : JSON.stringify(content)
}

export function sanitizeAiConversationTitle(value: string) {
  const title = value
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(title|conversation title)\s*:\s*/i, '')
    .trim()

  if (!title) {
    return null
  }

  return title.length > MAX_AI_CONVERSATION_TITLE_LENGTH
    ? title.slice(0, MAX_AI_CONVERSATION_TITLE_LENGTH).trimEnd()
    : title
}

/**
 * Produces a cosmetic summary only. The persisted deterministic title remains
 * available as the fallback if the model is unavailable or returns bad output.
 */
export async function generateAiConversationTitle(params: {
  firstUserMessage: string
  firstAssistantMessage: string
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  const model = new ChatOpenAI({
    model: UTILITY_MODEL,
    temperature: 0,
    apiKey,
  })
  const response = await model.invoke([
    new SystemMessage(
      [
        'Create a concise title for an AI-BOSS financial workspace conversation.',
        'Return only the title: no quotes, labels, punctuation-only output, or explanation.',
        'Use 3 to 6 words and no more than 48 characters.',
        'Describe the concrete finance topic. Never use generic wording such as AI-BOSS chat, conversation, help, or question.',
      ].join(' '),
    ),
    new HumanMessage(
      JSON.stringify({
        firstUserMessage: params.firstUserMessage,
        firstAssistantMessage: params.firstAssistantMessage,
      }),
    ),
  ])

  return sanitizeAiConversationTitle(modelContentToText(response.content))
}
