import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { runFinancialAnalysisAgent } from '@/lib/agents/financial-analysis-agent'
import { runForecastingAgent } from '@/lib/agents/forecasting-agent'
import { ApiError } from '@/lib/api/errors'
import { CHAT_MODEL } from '@/lib/chat/system-prompt'
import type { AgentRunResult } from '@/lib/ai/agent'

type AgentIntent = 'financial_analysis' | 'forecasting_scenario'

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

const COORDINATOR_RESPONSE_PROMPT = `You are AI-BOSS, an intelligent AI financial companion. You respond like a trusted CIMA-qualified advisor who knows this business personally — not a template, not a chatbot.

A specialist agent has retrieved the financial data. Present it naturally, adapting your response to exactly what the user asked.

Core rules:
- CRITICAL: Never recalculate or reinterpret numbers yourself. Use ONLY the figures in the specialist output — runway months, burn rate, cash, etc. exactly as they appear. Do not do your own maths.
- Always start by directly answering the question with the actual number from the specialist output
- Reference their specific figures throughout — never speak in generalities
- Only flag a risk if one genuinely exists in the data
- End with 1-2 next steps that are specific to their situation and what they just asked about
- Never give the same boilerplate recommendations every time — tailor them to the question
- If data is missing, say so clearly and tell them exactly what to provide and why
- Tone: direct, warm, confident — like a CFO giving a quick briefing, not a report template

Adapt your response to the question type:
- Runway question → focus on their specific months, burn rate, and what that means for their planning horizon
- Scenario question → focus on the before/after impact and whether the change is worth it given their position
- Forecasting question → focus on the trend direction and what they should do given where they are heading
- Ratio/margin question → calculate it if data exists, explain what it means for their profitability specifically
- Missing data → be honest, specific about what is missing, and explain what they could unlock with that data

Never use a rigid section template. Write naturally. Use bold headers only when they genuinely help readability.`

function createLLM() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Missing required environment variable: OPENAI_API_KEY.')
  }
  return new ChatOpenAI({ model: CHAT_MODEL, temperature: 0, apiKey })
}

async function classifyIntent(query: string): Promise<AgentIntent> {
  const llm = createLLM()
  const response = await llm.invoke([
    new SystemMessage(COORDINATOR_SYSTEM_PROMPT),
    new HumanMessage(query),
  ])

  const content = typeof response.content === 'string'
    ? response.content.trim().toLowerCase()
    : ''

  if (content === 'forecasting_scenario') return 'forecasting_scenario'
  return 'financial_analysis'
}

async function narrateResponse(
  userId: string,
  query: string,
  specialistOutput: string
): Promise<string> {
  const llm = createLLM()
  const response = await llm.invoke([
    new SystemMessage(COORDINATOR_RESPONSE_PROMPT),
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
  query: string
): Promise<AgentRunResult> {
  const intent = await classifyIntent(query)

  const specialistResult = intent === 'forecasting_scenario'
    ? await runForecastingAgent(userId, query)
    : await runFinancialAnalysisAgent(userId, query)

  const narratedResponse = await narrateResponse(userId, query, specialistResult.content)

  return {
    content: narratedResponse,
    tokensUsed: specialistResult.tokensUsed,
    toolsUsed: specialistResult.toolsUsed,
  }
}
