import type { BaseMessage } from '@langchain/core/messages'
import { runAgent, type AgentRunResult } from '@/lib/ai/agent'
import { DEFAULT_MODEL, isModelName, type ModelName } from '@/lib/ai/models'
import { AGENT_SYSTEM_PROMPT } from '@/lib/chat/system-prompt'
import {
  getScenarioPreflightClarification,
  routeFinancialConversation,
  type FinancialSpecialist,
} from '@/lib/agents/router'
import { calculateRunwayTool } from '@/lib/tools/financial/calculate-runway'
import { createCalculateRatiosTool } from '@/lib/tools/financial/calculate-ratios'
import { createGetFinancialForecastTool } from '@/lib/tools/financial/get-financial-forecast'
import { createGetFinancialHistoryTool } from '@/lib/tools/financial/get-financial-history'
import { createGetLatestSnapshotTool } from '@/lib/tools/financial/get-latest-snapshot'
import { createModelScenarioTool } from '@/lib/tools/financial/model-scenario'
import type { AppTool } from '@/lib/tools/contracts'
import { isScenarioAnalysisResult } from '@/lib/scenarios/calculation'
import { formatScenarioAnalysisForChat } from '@/lib/scenarios/chat-summary'

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
You are handling deterministic what-if scenarios only. Use model_scenario for up to three alternatives containing fixed one-off or recurring cash flows, or fixed/compounding percentage changes to revenue, expenses, or burn. Never calculate financial results yourself.

Call model_scenario immediately when the user has supplied the decision, amount, recurrence, and timing. Do not ask the user to confirm facts already stated. Omit sourceKey when the user has not named a statement so the tool can auto-select the only valid source or return the exact source choices. Leave manualBaseline empty unless the user explicitly asks to replace a stored baseline value; never copy source values into manualBaseline. Use the default six-month horizon unless the user requests another supported horizon. Treat an explicitly monthly employer cost for a hire as a recurring outflow. Treat a confirmed monthly employer cost or saving for firing/dismissal as the recurring saving created by removing that cost, which is an inflow. Treat an equipment purchase as a one-off outflow. Resolve an unambiguous named month to its next occurrence inside the projection horizon. Never add depreciation, tax, legal, HR, redundancy, equipment, recruitment, or payroll assumptions unless the user supplied them.

A plain percentage is a fixed step; compounding requires explicit every-month wording. For hiring or firing, require confirmed total monthly employer cost or saving rather than converting annual salary. Ask only one focused question at a time in this order: source/currency, missing baseline values, amount/percentage, fixed/compounding, one-off/recurring, then start/end timing. If the tool requests source, currency, baseline, or assumptions, use its message and options. A financial answer is forbidden unless model_scenario returned status ready.`,
}

const SCENARIO_RETRY_INSTRUCTION = `

## Mandatory scenario tool retry
The scenario request must be handled through model_scenario. Re-read the full conversation, preserve the user's confirmed details, use supported defaults, and call the tool now when the assumptions are complete. Do not calculate, estimate, convert annual salary, or write a financial result yourself. If one critical input is genuinely missing, ask exactly one question.`

function appearsReadyForScenarioTool(input: string) {
  const value = input.toLowerCase()
  const hasAmount = /\b(?:nzd|aud)?\s*\d[\d,]*(?:\.\d+)?\b/.test(value)
  const hasTiming = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{4}-(?:0[1-9]|1[0-2]))\b/.test(value)
  const hasFrequency = /\b(?:per month|monthly|recurring|one[- ]off|one[- ]time|buy|buying|purchase|purchasing)\b/.test(value)

  return hasAmount && hasTiming && hasFrequency
}

function missingStaffReductionStartMonth(
  input: string,
  chatHistory: BaseMessage[]
) {
  const userHistory = chatHistory
    .filter((message) => message._getType() === 'human')
    .map((message) => typeof message.content === 'string' ? message.content : '')
    .join(' ')
  const fullRequest = `${userHistory} ${input}`.toLowerCase()
  const isStaffReduction = /\b(?:fir(?:e|ed|ing)|dismiss(?:al|ed|ing)?|layoff|lay off|redundan(?:cy|t|cies))\b/.test(fullRequest)
  const confirmsMonthlyAmount = /\b\d[\d,]*(?:\.\d+)?\b[^.?!]{0,30}\b(?:monthly|per month|monthly cost|monthly saving)\b|\b(?:monthly|per month|monthly cost|monthly saving)\b[^.?!]{0,30}\b\d[\d,]*(?:\.\d+)?\b/.test(input.toLowerCase())
  const hasStartTiming = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{4}-(?:0[1-9]|1[0-2])|immediately|right away|next month)\b/.test(fullRequest)

  return isStaffReduction && confirmsMonthlyAmount && !hasStartTiming
}

function scenarioToolOutcome(result: AgentRunResult) {
  for (const execution of result.toolExecutions ?? []) {
    if (execution.tool !== 'model_scenario' || !execution.result || typeof execution.result !== 'object') continue
    const toolResult = execution.result as { status?: unknown; result?: unknown; message?: unknown }
    if (toolResult.status === 'ready' && isScenarioAnalysisResult(toolResult.result)) {
      return { status: 'ready' as const, result: toolResult.result }
    }
    if (toolResult.status === 'needs_input' && typeof toolResult.message === 'string') {
      return { status: 'needs_input' as const, message: toolResult.message }
    }
  }
  return null
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
  const routingHistory = chatHistory.flatMap((message) => {
    const role = message._getType()
    const content = typeof message.content === 'string' ? message.content : ''
    return (role === 'human' || role === 'ai') && content
      ? [{ role: role === 'human' ? 'user' as const : 'assistant' as const, content }]
      : []
  })
  const specialist = routeFinancialConversation(input, routingHistory)
  const preflightClarification = getScenarioPreflightClarification(input)

  if (preflightClarification) {
    return {
      content: preflightClarification,
      tokensUsed: null,
      toolsUsed: [],
      toolExecutions: [],
      specialist,
      modelName: modelOverride ?? modelForSpecialist(specialist),
    }
  }

  const modelName = modelOverride ?? modelForSpecialist(specialist)

  if (specialist === 'scenario' && missingStaffReductionStartMonth(input, chatHistory)) {
    return {
      content: 'Which month should the confirmed monthly saving start?',
      tokensUsed: null,
      toolsUsed: [],
      toolExecutions: [],
      specialist,
      modelName,
    }
  }

  const tools = specialistTools(userId, specialist)
  let result = await runAgent(
    input,
    chatHistory,
    tools,
    contextMessages,
    SPECIALIST_PROMPTS[specialist],
    modelName
  )

  if (specialist === 'scenario') {
    const usedScenarioTool = scenarioToolOutcome(result) !== null
    const questionCount = (result.content.match(/\?/g) ?? []).length

    if (
      !usedScenarioTool &&
      (questionCount !== 1 || appearsReadyForScenarioTool(input))
    ) {
      // The retry runs on the same model as the first attempt, so a user who
      // picked a model is not silently switched to the default mid-answer.
      result = await runAgent(
        input,
        chatHistory,
        tools,
        contextMessages,
        `${SPECIALIST_PROMPTS.scenario}${SCENARIO_RETRY_INSTRUCTION}`,
        modelName
      )
    }

    const retryUsedScenarioTool = scenarioToolOutcome(result) !== null
    const retryQuestionCount = (result.content.match(/\?/g) ?? []).length
    if (!retryUsedScenarioTool && retryQuestionCount !== 1) {
      result = {
        content: 'I could not run the trusted scenario calculator, so I will not provide estimated financial results. Please restate the scenario with one confirmed monthly amount and start month, or use the Scenarios workspace.',
        tokensUsed: result.tokensUsed,
        toolsUsed: result.toolsUsed,
        toolExecutions: result.toolExecutions ?? [],
      }
    }

    const toolOutcome = scenarioToolOutcome(result)
    if (toolOutcome?.status === 'ready') {
      result = {
        ...result,
        content: formatScenarioAnalysisForChat(toolOutcome.result),
      }
    } else if (toolOutcome?.status === 'needs_input') {
      result = {
        ...result,
        content: toolOutcome.message,
      }
    }
  }

  return { ...result, specialist, modelName }
}
