import type { BaseMessage } from '@langchain/core/messages'
import { runAgent, type AgentRunResult } from '@/lib/ai/agent'
import { DEFAULT_MODEL, isModelName, type ModelName } from '@/lib/ai/models'
import { AGENT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'
import { routeFinancialQuestion, type FinancialSpecialist } from '@/lib/agents/router'
import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'
import { createCalculateRatiosTool } from '@/lib/tools/financial/calculate-ratios'
import { createGetFinancialForecastTool } from '@/lib/tools/financial/get-financial-forecast'
import { createGetFinancialHistoryTool } from '@/lib/tools/financial/get-financial-history'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { createModelScenarioTool } from '@/lib/tools/financial/model-scenario'
import type { AppTool } from '@/lib/tools/contracts'

const SPECIALIST_PROMPTS: Record<FinancialSpecialist, string> = {
  financial_position: `${AGENT_SYSTEM_PROMPT}

## Assigned specialist
You are handling current financial position, runway and financial ratios. Use get_latest_snapshot for current values. Use calculate_runway only from confirmed snapshot values. Use calculate_ratios for any question about margins, profitability, liquidity or leverage — never work a ratio out yourself, and never substitute a near-enough input such as treating cash plus receivables as current assets. If calculate_ratios reports a ratio as unavailable, state exactly which figures are missing. If the request is about history, forecasting, or a scenario, explain that this request needs the appropriate analysis instead of inventing an answer.

### Reporting ratios
Always carry through the status the tool assigned and the threshold it used. Never restate a ratio without its band, and never upgrade, soften or re-judge a status the tool has set.

When the tool returns more than one ratio, read them together instead of listing them one by one. Say what the combination means for the business, and name the tension explicitly whenever one ratio is strong and another is weak — for example, healthy margins alongside a current ratio below 1 mean the business is profitable but may not be able to meet its short-term obligations, while strong liquidity alongside a weak operating margin means it can pay its bills but is not converting revenue into profit. Where two ratios point the same way, say so plainly rather than repeating the same conclusion twice.

Do not introduce benchmarks the tool did not supply, and do not compare the business to an industry average — no industry data is available to you.`,
  historical_forecast: `${AGENT_SYSTEM_PROMPT}

## Assigned specialist
You are handling historical review and deterministic forecasts only. Use get_financial_history for past movement and get_financial_forecast for future trend continuation. If the tool returns NZD and AUD series, preserve both in the final answer with separate headings and figures; concision must never remove a returned currency. Do not calculate present runway or model scenarios.`,
  scenario: `${AGENT_SYSTEM_PROMPT}

## Assigned specialist
You are handling recurring burn scenarios only. Use model_scenario for direct monthly amounts or explicit burn percentages. For a percentage, pass burn_percentage_change exactly as stated: a reduction is negative and an increase is positive. Never calculate the dollar amount yourself. Do not model revenue percentages; explain that only monthly-burn changes are supported.`,
}

const SPECIALIST_MODELS: Record<FinancialSpecialist, ModelName> = {
  financial_position: DEFAULT_MODEL,
  historical_forecast: DEFAULT_MODEL,
  scenario: DEFAULT_MODEL,
}

export function modelForSpecialist(specialist: FinancialSpecialist): ModelName {
  const override = process.env[`AI_MODEL_${specialist.toUpperCase()}`]

  if (!override) {
    return SPECIALIST_MODELS[specialist]
  }

  if (!isModelName(override)) {
    console.warn(
      `Unknown model "${override}" in AI_MODEL_${specialist.toUpperCase()}; ` +
        `using ${SPECIALIST_MODELS[specialist]} instead.`
    )
    return SPECIALIST_MODELS[specialist]
  }

  return override
}

function specialistTools(userId: string, specialist: FinancialSpecialist): AppTool[] {
  if (specialist === 'financial_position') {
    return [
      createGetLatestSnapshotTool(userId),
      calculateRunwayTool,
      createCalculateRatiosTool(userId),
    ]
  }

  if (specialist === 'historical_forecast') {
    return [
      createGetFinancialHistoryTool(userId),
      createGetFinancialForecastTool(userId),
    ]
  }

  return [createModelScenarioTool(userId)]
}

function validatePercentageScenarioRequest(input: string) {
  const value = input.toLowerCase()
  if (!value.includes('%')) return null

  if (/\b(revenue|sales|income)\b/.test(value)) {
    return 'AI-BOSS currently supports percentage scenarios for monthly burn only. Revenue percentage scenarios are not supported yet.'
  }

  if (!/\bburn\b/.test(value)) {
    return 'Please specify monthly burn for a percentage scenario, for example: "cut monthly burn by 20%". AI-BOSS does not assume which metric a percentage applies to.'
  }

  return null
}

export interface MultiAgentRunResult extends AgentRunResult {
  specialist: FinancialSpecialist
  modelName: ModelName
}

export async function runMultiAgent(
  userId: string,
  input: string,
  chatHistory: BaseMessage[] = [],
  contextMessages: BaseMessage[] = [],
  modelOverride?: ModelName
): Promise<MultiAgentRunResult> {
  const specialist = routeFinancialQuestion(input)
  const percentageValidation =
    specialist === 'scenario' ? validatePercentageScenarioRequest(input) : null

  if (percentageValidation) {
    return {
      content: percentageValidation,
      tokensUsed: null,
      toolsUsed: [],
      specialist,
      modelName: modelOverride ?? modelForSpecialist(specialist),
    }
  }

  const modelName = modelOverride ?? modelForSpecialist(specialist)
  const result = await runAgent(
    input,
    chatHistory,
    specialistTools(userId, specialist),
    contextMessages,
    SPECIALIST_PROMPTS[specialist],
    modelName
  )

  return { ...result, specialist, modelName }
}
