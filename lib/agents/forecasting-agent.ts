import { runAgent } from '@/lib/ai/agent'
import { createModelScenarioTool } from '@/lib/tools/financial/model-scenario'
import { createGetRunwayHistoryTool } from '@/lib/tools/financial/get-runway-history'
import { createForecastRunwayTrendTool } from '@/lib/tools/financial/forecast-runway-trend'
import type { AgentRunResult } from '@/lib/ai/agent'

const FORECASTING_SYSTEM_PROMPT = `You are a specialist forecasting and scenario agent within AI-BOSS.

Your only job is to answer forward-looking financial questions and model what-if scenarios.

You have three tools:
- get_runway_history: use this when the user asks about historical trends, whether finances are improving or declining, or past changes
- forecast_runway_trend: use this when the user asks about future projections, where the business is headed, or when runway may hit a threshold
- model_scenario: use this when the user asks what-if questions about cost changes, hiring, cutting expenses, or any recurring spend change

Rules:
- Pick the right tool based on the question — do not call all three every time
- For historical questions: use get_runway_history
- For future projection questions: use forecast_runway_trend
- For what-if questions: use model_scenario
- Never invent financial figures — only use tool outputs
- Always present forecasts as estimates based on current trends, not guarantees
- Flag clearly if the projected outcome is urgent or concerning
- Be concise and structured — you are a specialist, not a generalist
- Return a clear summary for the coordinator to present to the user`

export async function runForecastingAgent(
  userId: string,
  query: string
): Promise<AgentRunResult> {
  const tools = [
    createGetRunwayHistoryTool(userId),
    createForecastRunwayTrendTool(userId),
    createModelScenarioTool(userId),
  ]

  return runAgent(query, [], tools, [], FORECASTING_SYSTEM_PROMPT)
}
