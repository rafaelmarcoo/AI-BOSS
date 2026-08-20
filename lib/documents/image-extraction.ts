import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import { ApiError } from '@/lib/api/errors'

const OPENAI_VISION_MODEL = 'gpt-4o'

const IMAGE_EXTRACTION_PROMPT =
  'Transcribe all readable text from this image exactly as it appears, ' +
  'preserving table structure using plain text alignment where possible. ' +
  'If the image contains a financial document (receipt, invoice, statement, ' +
  'ledger), also note the document type and any totals, dates, or line items ' +
  'you can identify. Do not summarize or omit content — transcribe everything visible.'

const IMAGE_METRICS_PROMPT =
  'Identify any financial figures in this image (expenses, revenue, totals, ' +
  'line items, department or category breakdowns, etc.). Return them as a ' +
  'flat JSON object mapping a short, human-readable label to its numeric ' +
  'value, e.g. {"Icecream Expenses": 500, "Revenue": 4000}. Only include ' +
  'values you can clearly read. If there are no financial figures, return {}. ' +
  'Respond with ONLY the JSON object and nothing else — no markdown, no ' +
  'explanation.'

function parseMetricsJson(raw: string): Record<string, number> {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return {}
  }

  try {
    const parsed: unknown = JSON.parse(jsonMatch[0])

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const metrics: Record<string, number> = {}

    for (const [label, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        metrics[label] = value
      }
    }

    return metrics
  } catch {
    return {}
  }
}

export async function extractImageText(
  fileBytes: Uint8Array,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  const model = new ChatOpenAI({ model: OPENAI_VISION_MODEL, temperature: 0, apiKey })
  const base64Data = Buffer.from(fileBytes).toString('base64')

  const response = await model.invoke([
    new HumanMessage({
      content: [
        { type: 'text', text: IMAGE_EXTRACTION_PROMPT },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Data}` },
        },
      ],
    }),
  ])

  return typeof response.content === 'string' ? response.content.trim() : ''
}

export async function extractImageMetrics(
  fileBytes: Uint8Array,
  mimeType: string
): Promise<Record<string, number>> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  const model = new ChatOpenAI({ model: OPENAI_VISION_MODEL, temperature: 0, apiKey })
  const base64Data = Buffer.from(fileBytes).toString('base64')

  const response = await model.invoke([
    new HumanMessage({
      content: [
        { type: 'text', text: IMAGE_METRICS_PROMPT },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Data}` },
        },
      ],
    }),
  ])

  const raw = typeof response.content === 'string' ? response.content : ''
  return parseMetricsJson(raw)
}

// --- Anthropic vision alternative (currently unused) ---
// If the image extraction provider switches back from OpenAI to Anthropic,
// swap the implementation above for this one.
//
// import Anthropic from '@anthropic-ai/sdk'
//
// const ANTHROPIC_VISION_MODEL = 'claude-sonnet-5'
//
// function getAnthropicClient() {
//   const apiKey = process.env.ANTHROPIC_API_KEY
//
//   if (!apiKey) {
//     throw new ApiError(
//       500,
//       'INTERNAL_ERROR',
//       'Missing required environment variable: ANTHROPIC_API_KEY.'
//     )
//   }
//
//   return new Anthropic({ apiKey })
// }
//
// export async function extractImageText(
//   fileBytes: Uint8Array,
//   mimeType: string
// ): Promise<string> {
//   const client = getAnthropicClient()
//   const base64Data = Buffer.from(fileBytes).toString('base64')
//
//   const response = await client.messages.create({
//     model: ANTHROPIC_VISION_MODEL,
//     max_tokens: 4096,
//     messages: [
//       {
//         role: 'user',
//         content: [
//           {
//             type: 'image',
//             source: {
//               type: 'base64',
//               media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
//               data: base64Data,
//             },
//           },
//           {
//             type: 'text',
//             text: IMAGE_EXTRACTION_PROMPT,
//           },
//         ],
//       },
//     ],
//   })
//
//   const textBlock = response.content.find((block) => block.type === 'text')
//
//   if (!textBlock || textBlock.type !== 'text') {
//     return ''
//   }
//
//   return textBlock.text.trim()
// }
