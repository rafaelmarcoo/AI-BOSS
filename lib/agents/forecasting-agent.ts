import { runAgent } from '@/lib/ai/agent'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { createModelScenarioTool } from '@/lib/tools/financial/model-scenario'
import { createGetRunwayHistoryTool } from '@/lib/tools/financial/get-runway-history'
import { createForecastRunwayTrendTool } from '@/lib/tools/financial/forecast-runway-trend'
import type { BaseMessage } from '@langchain/core/messages'
import type { AgentRunResult } from '@/lib/ai/agent'

const FORECASTING_SYSTEM_PROMPT = `You are a specialist forecasting and scenario data agent within AI-BOSS.

Your only job is to retrieve forecasting or scenario data and return the raw results. Do NOT explain, interpret, or format the output — just return the numbers clearly.

You have four tools:
- get_latest_snapshot: use this FIRST when the user mentions a percentage change (e.g. "cut by 20%", "reduce by 15%") so you can get the current burn rate and calculate the actual dollar amount
- get_runway_history: for historical trend questions
- forecast_runway_trend: for future projection questions
- model_scenario: for what-if questions about cost or spend changes — requires a dollar amount for monthly_cost_change

Rules:
- If the user asks about a percentage change, call get_latest_snapshot first to get the current burn rate, calculate the dollar amount yourself, then call model_scenario with that dollar value
- For historical questions: use get_runway_history
- For future projection questions: use forecast_runway_trend
- For what-if questions with a dollar amount: use model_scenario directly
- Never invent financial figures — only use tool outputs
- Return raw results only — the coordinator will handle all interpretation and advice`

export async function runForecastingAgent(
  userId: string,
  query: string,
  chatHistory: BaseMessage[] = [],
  contextMessages: BaseMessage[] = []
): Promise<AgentRunResult> {
  const tools = [
    createGetLatestSnapshotTool(userId),
    createGetRunwayHistoryTool(userId),
    createForecastRunwayTrendTool(userId),
    createModelScenarioTool(userId),
  ]

  return runAgent(
    query,
    chatHistory,
    tools,
    contextMessages,
    FORECASTING_SYSTEM_PROMPT
  )
}
