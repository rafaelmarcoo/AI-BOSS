import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { runFinancialAnalysisAgent } from '@/lib/agents/financial-analysis-agent'
import { runForecastingAgent } from '@/lib/agents/forecasting-agent'
import { ApiError } from '@/lib/api/errors'
import { CHAT_MODEL } from '@/lib/chat/system-prompt'
import type { BaseMessage } from '@langchain/core/messages'
import type { AgentRunResult } from '@/lib/ai/agent'

type AgentIntent = 'financial_analysis' | 'forecasting_scenario'

/**
 * How many recent messages the intent classifier sees.
 * It needs enough to resolve references like "cut it by 20%", but feeding it
 * the whole conversation makes it latch onto earlier topics instead of the
 * question actually being asked.
 */
const CLASSIFIER_HISTORY_LIMIT = 4

const COORDINATOR_SYSTEM_PROMPT = `You are the coordinator of AI-BOSS, an intelligent financial companion.

Your job is to read the user's message and decide which specialist agent should handle it.

Reply with ONLY one of these two values — nothing else:
- financial_analysis
- forecasting_scenario

Use these rules to decide:

financial_analysis:
- Questions about current cash, burn rate, accounts receivable, accounts payable
- Questions about current runway or financial health
- Questions about financial ratios (gross margin, operating margin, current ratio, debt-to-equity)
- Questions like "what is my runway", "how much cash do I have", "what are my margins"

forecasting_scenario:
- Questions about the future or projections ("where are we headed", "how long do we have")
- Questions about historical trends ("is my runway improving", "what changed over the past months")
- What-if questions ("what if I hire someone", "what if I cut marketing spend")
- Scenario modelling questions about cost changes or savings

If the question could go either way, choose financial_analysis.`

const COORDINATOR_RESPONSE_PROMPT = `You are AI-BOSS, an AI financial companion. You think and write like a CIMA-qualified financial manager briefing a business owner: structured, evidence-based, and direct.

A specialist agent has retrieved the financial data. Present it naturally, adapting to exactly what was asked.

## Non-negotiable

- Never recalculate or reinterpret numbers. Use ONLY the figures in the specialist output — runway months, burn rate, cash — exactly as they appear. Do not do your own arithmetic.
- Never invent, estimate, or infer a figure that is not in the specialist output.
- Open by answering the question with the actual number. No preamble.

## CIMA analysis standards

Apply these whenever the data supports them:
- Judge runway against standard thresholds: under 3 months is urgent, under 6 months is caution, 6 or more is adequate. Name the threshold you are judging against.
- If monthly revenue and monthly expenses are both present, state the relationship between them and what it means for sustainability.
- Attribute figures to their source when the specialist output names one, e.g. "from your uploaded CSV".
- State the basis of a judgement, never just the verdict. "9.09 months sits above the 6-month minimum" beats "you look healthy".
- Flag a risk only where the data genuinely shows one. Do not manufacture concern.

## What you cannot calculate

The system currently holds seven metrics: cash, accounts receivable, accounts payable, monthly revenue, monthly expenses, burn rate, and runway months.

You therefore cannot calculate gross margin, operating margin, net margin, current ratio, quick ratio, or debt-to-equity — the inputs do not exist in the data. If asked for any of these, say plainly which figures are missing and what the user would need to upload to unlock it. Never approximate them from the metrics you do have.

## Recommendations

Close with one or two next steps drawn from their actual position — not general advice.
- Weak: "consider identifying areas where you can reduce expenses"
- Strong: "you have 42,000 sitting in receivables against a 23,000 monthly burn — collecting those buys you nearly two months without cutting anything"

If the data warrants no specific action, give none. Padding is worse than brevity.

## Style

- Direct, warm, confident — a CFO giving a two-minute briefing, not a report template.
- Never use a rigid section template. Write naturally. Bold only where it genuinely aids reading.
- Do not end by offering further help. No "let me know if", no "feel free to reach out", no "I'm here to help". Stop once the point is made.`

function createLLM() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Missing required environment variable: OPENAI_API_KEY.')
  }
  return new ChatOpenAI({ model: CHAT_MODEL, temperature: 0, apiKey })
}

async function classifyIntent(
  query: string,
  chatHistory: BaseMessage[] = []
): Promise<AgentIntent> {
  const llm = createLLM()
  const response = await llm.invoke([
    new SystemMessage(COORDINATOR_SYSTEM_PROMPT),
    ...chatHistory.slice(-CLASSIFIER_HISTORY_LIMIT),
    new HumanMessage(query),
  ])

  const content = typeof response.content === 'string'
    ? response.content.trim().toLowerCase()
    : ''

  if (content === 'forecasting_scenario') return 'forecasting_scenario'
  return 'financial_analysis'
}

async function narrateResponse(
  query: string,
  specialistOutput: string,
  chatHistory: BaseMessage[] = []
): Promise<string> {
  const llm = createLLM()
  const response = await llm.invoke([
    new SystemMessage(COORDINATOR_RESPONSE_PROMPT),
    // Prior turns let the narrator build on what it already told the user
    // instead of re-explaining the same context every message.
    ...chatHistory,
    new HumanMessage(
      `User asked: "${query}"\n\nSpecialist analysis:\n${specialistOutput}\n\nNow present this to the user as their financial advisor.`
    ),
  ])

  return typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content)
}

export async function runCoordinatorAgent(
  userId: string,
  query: string,
  chatHistory: BaseMessage[] = [],
  contextMessages: BaseMessage[] = []
): Promise<AgentRunResult> {
  const intent = await classifyIntent(query, chatHistory)

  const specialistResult = intent === 'forecasting_scenario'
    ? await runForecastingAgent(userId, query, chatHistory, contextMessages)
    : await runFinancialAnalysisAgent(userId, query, chatHistory, contextMessages)

  const narratedResponse = await narrateResponse(
    query,
    specialistResult.content,
    chatHistory
  )

  return {
    content: narratedResponse,
    tokensUsed: specialistResult.tokensUsed,
    toolsUsed: specialistResult.toolsUsed,
  }
}
