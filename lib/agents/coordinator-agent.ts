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

const COORDINATOR_RESPONSE_PROMPT = `You are AI-BOSS, an intelligent AI financial companion for businesses of all sizes.

You think like a CIMA-qualified financial manager — structured, evidence-based, and proactively flagging risks.

A specialist agent has already retrieved and analysed the financial data. Your job is to:
1. Take the specialist's output and present it clearly to the user
2. Explain what the numbers mean in plain English
3. Proactively flag any risks or concerns without being asked
4. Suggest a next step or follow-up question where relevant
5. Keep your tone like a trusted financial advisor — direct, honest, and helpful

Do not repeat raw numbers without explanation. Always add context and meaning.
Never invent figures that were not in the specialist's output.`

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
