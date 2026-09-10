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
  'flat JSON object mapping a short, human-readable label to its value ' +
  'exactly as written in the image, as a string, e.g. ' +
  '{"Icecream Expenses": "500", "Revenue": "4000"}. Include every value you ' +
  'can see next to a label, even if it does not look like a valid number ' +
  '(e.g. {"Expenses": "egg"}) — do not skip or omit anything, do not try to ' +
  'correct or guess at a number. If there are no financial figures, return ' +
  '{}. Respond with ONLY the JSON object and nothing else — no markdown, no ' +
  'explanation.'

export interface ImageMetricIssue {
  label: string
  rawValue: string
}

export interface ImageMetricsResult {
  metrics: Record<string, number>
  issues: ImageMetricIssue[]
}

function parseMetricsJson(raw: string): ImageMetricsResult {
  const empty: ImageMetricsResult = { metrics: {}, issues: [] }
  const jsonMatch = raw.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return empty
  }

  try {
    const parsed: unknown = JSON.parse(jsonMatch[0])

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return empty
    }

    const metrics: Record<string, number> = {}
    const issues: ImageMetricIssue[] = []

    for (const [label, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        metrics[label] = value
        continue
      }

      const rawValue = String(value).trim()

      if (!rawValue) {
        continue
      }

      const numeric = Number(rawValue.replace(/[,$£€¥]/g, ''))

      if (Number.isFinite(numeric)) {
        metrics[label] = numeric
      } else {
        issues.push({ label, rawValue })
      }
    }

    return { metrics, issues }
  } catch {
    return empty
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
): Promise<ImageMetricsResult> {
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
