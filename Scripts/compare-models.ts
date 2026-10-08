import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { runMultiAgent } from '../lib/agents/specialists'
import { MODEL_CATALOG, MODEL_NAMES, type ModelName } from '../lib/ai/models'

const TIMEOUT_MS = 90_000
const OUTPUT_DIR = 'docs'

interface Question {
  id: string
  prompt: string
  tests: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  expectedSpecialist?: 'financial_position' | 'historical_forecast' | 'scenario'
}

const QUESTIONS: Question[] = [
  {
    id: 'runway',
    prompt: 'What is my runway?',
    tests: 'Control. Should be near-identical everywhere; divergence here suggests a harness problem, not a model difference.',
    expectedSpecialist: 'financial_position',
  },
  {
    id: 'current-ratio',
    prompt: 'What is my current ratio?',
    tests: 'Refusal. Current assets and liabilities are not stored. Does it refuse, or substitute (cash + AR) / AP and report a confident wrong number?',
    expectedSpecialist: 'financial_position',
  },
  {
    id: 'gross-margin',
    prompt: 'What is my gross margin?',
    tests: 'Refusal. Cost of sales is missing. Does it name the missing input or invent one?',
    expectedSpecialist: 'financial_position',
  },
  {
    id: 'history',
    prompt: 'How has my cash changed over recent months?',
    tests: 'Historical retrieval via get_financial_history. Does it report the actual movement across periods, or fall back to the current snapshot and describe one point in time as a trend?',
    expectedSpecialist: 'historical_forecast',
  },
  {
    id: 'forecast',
    prompt: 'Forecast my runway for the next 6 months.',
    tests: 'Forward projection via get_financial_forecast. Does it use the deterministic forecast tool, or extrapolate in prose from the current figure?',
    expectedSpecialist: 'historical_forecast',
  },
  {
    id: 'burn-percentage',
    prompt: 'What if I cut monthly burn by 20%?',
    tests: 'Tool and argument correctness. Should reach model_scenario with a percentage, not a dollar amount.',
    expectedSpecialist: 'scenario',
  },
  {
    id: 'hire',
    prompt: 'What if I hire someone for 8,000 a month?',
    tests: 'Different tool path — a dollar amount rather than a percentage.',
    expectedSpecialist: 'scenario',
  },
  {
    id: 'elliptical-followup',
    prompt: 'And what about 30%?',
    tests: 'Hardest routing case. No noun in the question; only answerable from prior turns.',
    expectedSpecialist: 'scenario',
    history: [
      { role: 'user', content: 'What if I cut monthly burn by 20%?' },
      {
        role: 'assistant',
        content:
          'Cutting monthly burn by 20% would extend your runway from 9.09 months to 11.36 months.',
      },
    ],
  },
]


const COMPATIBILITY_NOTES = [
  '## Provider compatibility',
  '',
  'Seven of the eight models run through `ChatOpenAI` with a different base URL,',
  'because most providers implement the OpenAI API format. Gemini needed two',
  'specific changes, both found by measurement:',
  '',
  '**1. It cannot use the OpenAI compatibility endpoint for tool calling.**',
  'Gemini 3 returns a proprietary `thought_signature` inside `extra_content.google`',
  'and requires it echoed back on the next turn. That field is not part of the',
  'OpenAI schema, so an OpenAI client drops it. Verified directly:',
  '',
  '| Second turn | Result |',
  '|---|---|',
  '| Assistant message echoed back intact | 200 OK |',
  '| `extra_content` stripped | 400 |',
  '',
  'The API is explicit: _"Function call is missing a thought_signature in',
  'functionCall parts."_ First turn succeeds, second always fails — which is why a',
  'single-turn connectivity check passes while every real question fails. Unrelated',
  'to billing; it behaves identically on the paid tier. Gemini therefore uses',
  "Google's native SDK (`@langchain/google-genai`).",
  '',
  '**2. It rejects JSON Schema keywords that Zod emits.**',
  'Google accepts a subset of OpenAPI schema. `z.number().positive()` compiles to',
  '`exclusiveMinimum`, which is refused outright:',
  '',
  '> `Unknown name "exclusiveMinimum" at ' +
    "'tools[0].function_declarations[1].parameters.properties[3]'`",
  '',
  'Tools bound for Gemini therefore have those keywords stripped',
  '(`lib/ai/tools.ts`). The tradeoff is that Google no longer sees the constraint —',
  'an invalid value is caught by Zod in the tool handler rather than prevented by',
  'the model, so the guardrail is one layer later for this provider only.',
  '',
  '**Why this matters beyond Gemini:** the same pattern applies to any provider',
  'without an OpenAI-compatible endpoint, Anthropic included. A single-turn',
  'connectivity check is not sufficient evidence that a provider can run an agent.',
]

interface Result {
  model: ModelName
  questionId: string
  status: 'ok' | 'failed'
  answer: string
  specialist: string | null
  toolsUsed: string[]
  tokensUsed: number | null
  ms: number
  error: string | null
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms)
    ),
  ])
}

function parseModelsArg(): ModelName[] {
  const arg = process.argv.find((value) => value.startsWith('--models='))
    ?? (process.argv.includes('--models')
      ? process.argv[process.argv.indexOf('--models') + 1]
      : undefined)

  if (!arg) return MODEL_NAMES

  const requested = arg.replace('--models=', '').split(',').map((s) => s.trim())
  const unknown = requested.filter((name) => !MODEL_NAMES.includes(name as ModelName))

  if (unknown.length > 0) {
    console.error(`Unknown model(s): ${unknown.join(', ')}`)
    console.error(`Available: ${MODEL_NAMES.join(', ')}`)
    process.exit(1)
  }

  return requested as ModelName[]
}

async function runOne(
  userId: string,
  model: ModelName,
  question: Question
): Promise<Result> {
  const history = (question.history ?? []).map((message) =>
    message.role === 'user'
      ? new HumanMessage(message.content)
      : new AIMessage(message.content)
  )

  const startedAt = Date.now()

  try {
    const result = await withTimeout(
      runMultiAgent(userId, question.prompt, history, [], model),
      TIMEOUT_MS
    )

    return {
      model,
      questionId: question.id,
      status: 'ok',
      answer: result.content,
      specialist: result.specialist,
      toolsUsed: result.toolsUsed.map((tool) => tool.tool),
      tokensUsed: result.tokensUsed,
      ms: Date.now() - startedAt,
      error: null,
    }
  } catch (error) {
    return {
      model,
      questionId: question.id,
      status: 'failed',
      answer: '',
      specialist: null,
      toolsUsed: [],
      tokensUsed: null,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
function demoteHeadings(answer: string) {
  return answer.replace(
    /^(#{1,4}) /gm,
    (_match, hashes: string) =>
      `${'#'.repeat(Math.min(6, Math.max(5, hashes.length + 2)))} `
  )
}

function buildMarkdown(models: ModelName[], results: Result[]) {
  const find = (model: ModelName, questionId: string) =>
    results.find((r) => r.model === model && r.questionId === questionId)

  const lines: string[] = [
    '# Model comparison',
    '',
    `Generated ${new Date().toISOString()}`,
    '',
    'Produced by `npm run compare:models`. Each model answered the same questions',
    'through the real multi-agent path, so routing and tool selection are included.',
    '',
    '## Models tested',
    '',
    '| Model | Provider | API id |',
    '|---|---|---|',
    ...models.map((name) => {
      const spec = MODEL_CATALOG[name]
      return `| ${spec.label} | ${spec.provider} | \`${spec.model}\` |`
    }),
    '',
  ]

  const glmCount = models.filter((m) => MODEL_CATALOG[m].provider === 'zhipu').length
  if (glmCount > 1) {
    lines.push(
      `> Note: ${glmCount} of ${models.length} models are Zhipu GLM variants. Weight provider-level`,
      '> conclusions accordingly — GLM has more entries than the other providers.',
      ''
    )
  }

  lines.push('## Summary', '', '| Model | Answered | Failed | Avg tokens | Avg latency |', '|---|---|---|---|---|')

  for (const model of models) {
    const rows = results.filter((r) => r.model === model)
    const ok = rows.filter((r) => r.status === 'ok')
    const tokens = ok.map((r) => r.tokensUsed).filter((t): t is number => t !== null)
    const avgTokens = tokens.length
      ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length)
      : 0
    const avgMs = ok.length
      ? Math.round(ok.reduce((a, b) => a + b.ms, 0) / ok.length)
      : 0

    lines.push(
      `| ${MODEL_CATALOG[model].label} | ${ok.length} | ${rows.length - ok.length} | ${avgTokens} | ${(avgMs / 1000).toFixed(1)}s |`
    )
  }

  lines.push('', ...COMPATIBILITY_NOTES)

  lines.push(
    '',
    '## Routing',
    '',
    'Routing is done by `routeFinancialQuestion()` in `lib/agents/router.ts`, which is',
    'regex over the question text and runs **before** any model is involved. It is',
    'therefore identical across models and is not a point of comparison — it is',
    'listed here because it determines which tools and prompt each model received.',
    '',
    '| Question | Specialist | Expected |',
    '|---|---|---|'
  )

  for (const question of QUESTIONS) {
    const actual =
      models.map((model) => find(model, question.id)?.specialist).find(Boolean) ?? '—'
    const expected = question.expectedSpecialist ?? actual
    const flag = actual !== expected ? '' : ''

    lines.push(`| ${question.id} | \`${actual}\`${flag} | \`${expected}\` |`)
  }

  const misrouted = QUESTIONS.filter((question) => {
    if (!question.expectedSpecialist) return false
    const actual = models.map((m) => find(m, question.id)?.specialist).find(Boolean)
    return actual && actual !== question.expectedSpecialist
  })

  if (misrouted.length > 0) {
    lines.push(
      '',
      `> ${misrouted.length} question(s) reached the wrong specialist. Because routing is`,
      '> regex, this is a router limitation rather than a model one — the affected models',
      '> received the wrong tools and prompt, and any correct answer came from the model',
      '> compensating rather than from the intended path.',
      ''
    )
  }

  lines.push('', '## Answers', '')

  for (const question of QUESTIONS) {
    lines.push(`### ${question.id}`, '', `**Prompt:** ${question.prompt}`, '', `**Tests:** ${question.tests}`, '')

    for (const model of models) {
      const result = find(model, question.id)
      if (!result) continue

      lines.push(`#### ${MODEL_CATALOG[model].label}`, '')

      if (result.status === 'failed') {
        lines.push(`_Failed after ${(result.ms / 1000).toFixed(1)}s: ${result.error}_`, '')
        continue
      }

      lines.push(
        `\`${result.specialist}\` · tools: ${result.toolsUsed.join(', ') || 'none'} · ` +
          `${result.tokensUsed ?? '?'} tokens · ${(result.ms / 1000).toFixed(1)}s`,
        '',
        demoteHeadings(result.answer.trim()),
        ''
      )
    }
  }

  return lines.join('\n')
}

function readSavedResults(jsonPath: string): Result[] {
  try {
    const saved = JSON.parse(readFileSync(jsonPath, 'utf-8')) as { results?: Result[] }
    return saved.results ?? []
  } catch {
    return []
  }
}

function rebuildFromJson() {
  const jsonPath = resolve(process.cwd(), OUTPUT_DIR, 'model-comparison.json')
  const saved = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
    generatedAt: string
    results: Result[]
  }

  const models = [...new Set(saved.results.map((r) => r.model))]
  const markdownPath = resolve(process.cwd(), OUTPUT_DIR, 'model-comparison.md')

  writeFileSync(markdownPath, buildMarkdown(models, saved.results), 'utf-8')

  console.log(`\nRebuilt report from ${saved.results.length} saved results`)
  console.log(`  originally run ${saved.generatedAt}`)
  console.log(`\n  ${markdownPath}\n`)
}

async function main() {
  if (process.argv.includes('--from-json')) {
    rebuildFromJson()
    return
  }

  const userId = process.env.TEST_USER_ID

  if (!userId) {
    console.error('\nTEST_USER_ID is not set.\n')
    console.error('The comparison runs against real financial data, so it needs a user id.')
    console.error('Add this to .env.local:\n')
    console.error('  TEST_USER_ID=your-supabase-user-uuid\n')
    console.error('Find it in Supabase under Authentication > Users, or in the')
    console.error('user_id column of any of your own decision_log rows.\n')
    process.exit(1)
  }

  const models = parseModelsArg()
  const total = models.length * QUESTIONS.length

  console.log(`\nComparing ${models.length} models across ${QUESTIONS.length} questions (${total} calls)\n`)

  const results: Result[] = []
  let done = 0

  for (const model of models) {
    for (const question of QUESTIONS) {
      const result = await runOne(userId, model, question)
      results.push(result)
      done += 1

      const label = MODEL_CATALOG[model].label.padEnd(20)
      const status = result.status === 'ok' ? 'ok  ' : 'FAIL'
      const timing = `${(result.ms / 1000).toFixed(1)}s`.padStart(6)

      console.log(
        `[${String(done).padStart(2)}/${total}] ${status} ${label} ${question.id.padEnd(20)} ${timing}`
      )

      if (result.status === 'failed') {
        console.log(`         ${result.error?.slice(0, 100)}`)
      }
    }
  }

  mkdirSync(resolve(process.cwd(), OUTPUT_DIR), { recursive: true })

  const markdownPath = resolve(process.cwd(), OUTPUT_DIR, 'model-comparison.md')
  const jsonPath = resolve(process.cwd(), OUTPUT_DIR, 'model-comparison.json')

  const previous = readSavedResults(jsonPath)
  const rerun = new Set(models)
  const merged = [
    ...previous.filter((result) => !rerun.has(result.model)),
    ...results,
  ]
  const allModels = MODEL_NAMES.filter((name) =>
    merged.some((result) => result.model === name)
  )

  writeFileSync(markdownPath, buildMarkdown(allModels, merged), 'utf-8')
  writeFileSync(
    jsonPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), results: merged }, null, 2),
    'utf-8'
  )

  const failed = results.filter((r) => r.status === 'failed').length
  const carried = merged.length - results.length

  console.log(`\n${results.length - failed} answered, ${failed} failed`)
  if (carried > 0) {
    console.log(`${carried} result(s) carried over from the previous run`)
  }
  console.log(`\n  ${markdownPath}`)
  console.log(`  ${jsonPath}\n`)
}

main().catch((error) => {
  console.error('\nComparison failed:', error)
  process.exit(1)
})
