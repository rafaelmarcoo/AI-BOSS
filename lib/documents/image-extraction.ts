import Anthropic from '@anthropic-ai/sdk'
import { ApiError } from '@/lib/api/errors'

const ANTHROPIC_VISION_MODEL = 'claude-sonnet-5'

const IMAGE_EXTRACTION_PROMPT =
  'Transcribe all readable text from this image exactly as it appears, ' +
  'preserving table structure using plain text alignment where possible. ' +
  'If the image contains a financial document (receipt, invoice, statement, ' +
  'ledger), also note the document type and any totals, dates, or line items ' +
  'you can identify. Do not summarize or omit content — transcribe everything visible.'

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: ANTHROPIC_API_KEY.'
    )
  }

  return new Anthropic({ apiKey })
}

export async function extractImageText(
  fileBytes: Uint8Array,
  mimeType: string
): Promise<string> {
  const client = getAnthropicClient()
  const base64Data = Buffer.from(fileBytes).toString('base64')

  const response = await client.messages.create({
    model: ANTHROPIC_VISION_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: IMAGE_EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((block) => block.type === 'text')

  if (!textBlock || textBlock.type !== 'text') {
    return ''
  }

  return textBlock.text.trim()
}

// --- OpenAI vision alternative (currently unused) ---
// If the image extraction provider switches from Anthropic to OpenAI, swap
// the implementation above for this one. It reuses the same LangChain
// ChatOpenAI client already used in lib/ai/agent.ts, so no new SDK
// dependency is needed for this path.
//
// import { ChatOpenAI } from '@langchain/openai'
// import { HumanMessage } from '@langchain/core/messages'
//
// const OPENAI_VISION_MODEL = 'gpt-4o'
//
// export async function extractImageText(
//   fileBytes: Uint8Array,
//   mimeType: string
// ): Promise<string> {
//   const apiKey = process.env.OPENAI_API_KEY
//
//   if (!apiKey) {
//     throw new ApiError(
//       500,
//       'INTERNAL_ERROR',
//       'Missing required environment variable: OPENAI_API_KEY.'
//     )
//   }
//
//   const model = new ChatOpenAI({ model: OPENAI_VISION_MODEL, temperature: 0, apiKey })
//   const base64Data = Buffer.from(fileBytes).toString('base64')
//
//   const response = await model.invoke([
//     new HumanMessage({
//       content: [
//         { type: 'text', text: IMAGE_EXTRACTION_PROMPT },
//         {
//           type: 'image_url',
//           image_url: { url: `data:${mimeType};base64,${base64Data}` },
//         },
//       ],
//     }),
//   ])
//
//   return typeof response.content === 'string' ? response.content.trim() : ''
// }
