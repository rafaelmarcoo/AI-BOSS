/**
 * Local test script for the AI-BOSS LangChain agent.
 * Run with: npm run test:agent
 *
 * Tests the agent end-to-end against the real OpenAI API.
 * Requires OPENAI_API_KEY to be set in .env.local
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local before importing the agent so API keys are available
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    if (key) process.env[key.trim()] = rest.join('=').trim()
  }
} catch {
  console.warn('Warning: .env.local not found. Falling back to existing environment variables.')
}

import { runAgent } from '../lib/ai/agent'
import { getAgentTools } from '../lib/ai/tool-registry'

const TEST_USER_ID = process.env.TEST_USER_ID ?? '42dc8dcc-dcd1-4340-a8b6-bd45519f5a9d'

const DIVIDER = '─'.repeat(60)

async function runTest(label: string, input: string) {
  console.log(`\n${DIVIDER}`)
  console.log(`TEST: ${label}`)
  console.log(`USER: ${input}`)
  console.log(DIVIDER)

  const response = await runAgent(input, [], getAgentTools(TEST_USER_ID))
  console.log(`AGENT: ${response.content}`)
  console.log(`TOKENS: ${response.tokensUsed ?? 'unknown'}`)
  console.log(
    `TOOLS: ${
      response.toolsUsed.length > 0
        ? response.toolsUsed
            .map(({ tool, args }) => `${tool} ${JSON.stringify(args)}`)
            .join(', ')
        : 'none'
    }`
  )
}

async function main() {
  console.log('AI-BOSS Agent — Local Test')
  console.log(`Model: ${process.env.OPENAI_API_KEY ? 'API key found ✓' : 'NO API KEY FOUND ✗'}`)

  if (!process.env.OPENAI_API_KEY) {
    console.error('\nError: OPENAI_API_KEY is missing. Add it to your .env.local file.')
    process.exit(1)
  }

  await runTest(
    'Basic greeting',
    'Hi, what can you help me with?'
  )

  await runTest(
    'Financial question',
    'What is cash runway and why does it matter for my business?'
  )

  await runTest(
    'Runway question (tool-enabled)',
    "What's my runway if I have $100,000 cash, $20,000 in receivables, $5,000 in payables, and I burn $10,000 a month?"
  )

  await runTest(
    'Snapshot tool: fetch real data from DB',
    "What's my current runway based on my actual financial data?"
  )

  await runTest(
    'Scenario modelling — what if I hire someone',
    "What happens to my runway if I hire someone for $8,000 a month?"
  )

  console.log(`\n${DIVIDER}`)
  console.log('All tests completed.')
}

main().catch(err => {
  console.error('\nAgent test failed:', err)
  process.exit(1)
})
