import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'
import { CHAT_MODEL, mainModelOptions } from '@/lib/ai/model-config'
import type { FinancialAnalysisCollection } from '@/lib/financial-analysis/collector'
import { formatFinancialCurrency } from '@/lib/financial-data/currency'
import {
  FinancialAnalysisNarrativeSchema,
  type FinancialAnalysisNarrative,
  type FinancialPolicyEvaluation,
  type FinancialRecommendation,
} from '@/lib/financial-analysis/types'

export const SpecialistAnalysisOutputSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  risks: z.array(z.string().trim().min(1).max(300)).max(6),
  limitations: z.array(z.string().trim().min(1).max(300)).max(6),
}).strict()

export type SpecialistAnalysisOutput = z.infer<
  typeof SpecialistAnalysisOutputSchema
>

export interface StructuredAnalysisAgentResult<T> {
  output: T
  model: string | null
  tokensUsed: number | null
}

function createStructuredModel() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new ApiError(
      500,
      'INTERNAL_ERROR',
      'Missing required environment variable: OPENAI_API_KEY.'
    )
  }

  return new ChatOpenAI({
    model: CHAT_MODEL,
    ...mainModelOptions(),
    apiKey,
  })
}

function modelMetadata(message: AIMessage) {
  const responseModel = message.response_metadata?.model_name
  return {
    model: typeof responseModel === 'string' ? responseModel : CHAT_MODEL,
    tokensUsed: message.usage_metadata?.total_tokens ?? null,
  }
}

async function invokeStructuredAgent<T extends Record<string, unknown>>(params: {
  name: string
  schema: z.ZodType<T>
  systemPrompt: string
  input: unknown
}): Promise<StructuredAnalysisAgentResult<T>> {
  const agent = createStructuredModel().withStructuredOutput(params.schema, {
    name: params.name,
    method: 'jsonSchema',
    strict: true,
    includeRaw: true,
  })
  const response = await agent.invoke([
    new SystemMessage(params.systemPrompt),
    new HumanMessage(JSON.stringify(params.input)),
  ])

  if (!AIMessage.isInstance(response.raw)) {
    throw new Error(`${params.name} did not return an AI message.`)
  }

  return {
    output: params.schema.parse(response.parsed),
    ...modelMetadata(response.raw),
  }
}

function factInput(collection: FinancialAnalysisCollection) {
  return {
    currency: collection.selection.currency,
    readiness: collection.readiness,
    facts: collection.facts,
    assumptions: collection.assumptions,
  }
}

export async function runFinancialPositionAgent(
  collection: FinancialAnalysisCollection
) {
  return invokeStructuredAgent({
    name: 'financial_position_analysis',
    schema: SpecialistAnalysisOutputSchema,
    systemPrompt: [
      'You are the bounded Financial Position Agent for AI-BOSS.',
      'Explain only the deterministic facts supplied by the application.',
      'Cover current cash, cash runway, the separately labelled working-capital-adjusted runway, monthly operating balance, and receivables/payables position when available.',
      'Operating balance means monthly revenue minus monthly expenses. Never call it profit.',
      'Never convert currencies, invent missing facts, calculate new metrics, or provide more precision than supplied.',
      'State material limitations explicitly. Return concise structured output only.',
    ].join('\n'),
    input: factInput(collection),
  })
}

export async function runTrendForecastAgent(
  collection: FinancialAnalysisCollection
) {
  return invokeStructuredAgent({
    name: 'trend_forecast_analysis',
    schema: SpecialistAnalysisOutputSchema,
    systemPrompt: [
      'You are the bounded Trend and Forecast Agent for AI-BOSS.',
      'Explain only the supplied six-month history and deterministic six-month trend forecasts.',
      'Treat forecasts as date-aware linear trend continuation estimates, never guarantees.',
      'Do not invent causation, seasonality, budgets, profitability, ratios, transactions, customers, or market comparisons.',
      'Never convert currencies or calculate new values. State insufficient data and other limitations explicitly.',
      'Return concise structured output only.',
    ].join('\n'),
    input: factInput(collection),
  })
}

export async function runExecutiveSynthesizer(params: {
  collection: FinancialAnalysisCollection
  financialPosition: SpecialistAnalysisOutput
  trendForecast: SpecialistAnalysisOutput
  policy: FinancialPolicyEvaluation
  recommendations: FinancialRecommendation[]
}) {
  return invokeStructuredAgent({
    name: 'financial_analysis_executive_synthesis',
    schema: FinancialAnalysisNarrativeSchema,
    systemPrompt: [
      'You are the bounded Executive Synthesizer for AI-BOSS.',
      'Synthesize the supplied specialist text, deterministic policy result, and deterministic recommendations.',
      'Do not change, recalculate, rank, add, or remove deterministic facts, policy outcomes, or recommendation identifiers.',
      'Operating balance is not profit. Forecasts are continuation estimates, not guarantees.',
      'Never convert currencies or invent unsupported business details.',
      'Return concise structured output only.',
    ].join('\n'),
    input: {
      currency: params.collection.selection.currency,
      readiness: params.collection.readiness,
      financialPosition: params.financialPosition,
      trendForecast: params.trendForecast,
      policy: params.policy,
      recommendations: params.recommendations,
      assumptions: params.collection.assumptions,
    },
  })
}

export function buildFinancialPositionFallback(
  collection: FinancialAnalysisCollection
): SpecialistAnalysisOutput {
  const { runway, operatingBalance, receivablesPayables } = collection.facts
  const currency = collection.selection.currency
  const statements = [
    `The selected ${collection.selection.currency} baseline is ${collection.readiness.status.replaceAll('_', ' ')}.`,
    ...(runway
      ? [
          `Cash is ${formatFinancialCurrency(runway.cash, currency)} and monthly burn is ${formatFinancialCurrency(runway.monthlyBurnRate, currency)}, producing ${runway.cashRunwayMonths} months of cash runway.`,
          ...(runway.workingCapitalAdjustedRunwayMonths === null
            ? ['The working-capital-adjusted runway is unavailable from compatible current inputs.']
            : [`The separately labelled working-capital-adjusted runway is ${runway.workingCapitalAdjustedRunwayMonths} months.`]),
        ]
      : ['Current runway is unavailable from compatible cash and burn inputs.']),
    ...(operatingBalance
      ? [`Monthly operating balance is ${formatFinancialCurrency(operatingBalance.operatingBalance, currency)} (${operatingBalance.position}).`]
      : ['Monthly operating balance is unavailable from compatible revenue and expense inputs.']),
    ...(receivablesPayables
      ? [`Receivables minus payables is ${formatFinancialCurrency(receivablesPayables.netPosition, currency)} (${receivablesPayables.position.replaceAll('_', ' ')}).`]
      : ['The receivables/payables position is unavailable from compatible inputs.']),
  ]

  return SpecialistAnalysisOutputSchema.parse({
    summary: statements.join(' '),
    risks: runway && runway.cashRunwayMonths < 6
      ? ['Cash runway is below the 6-month healthy buffer.']
      : [],
    limitations: collection.readiness.reasons.slice(0, 6),
  })
}

export function buildTrendForecastFallback(
  collection: FinancialAnalysisCollection
): SpecialistAnalysisOutput {
  const histories = collection.facts.history
  const forecasts = collection.facts.forecasts
  const worsening = histories
    .filter((fact) => fact.direction === 'worsening')
    .map((fact) => fact.metricKey.replaceAll('_', ' '))

  return SpecialistAnalysisOutputSchema.parse({
    summary: histories.length === 0
      ? 'No comparable six-month history is available for deterministic trend analysis.'
      : `The six-month view contains ${histories.length} metric series; ${forecasts.length} support a six-month date-aware linear trend continuation estimate.`,
    risks: worsening.length > 0
      ? [`Worsening historical direction is present for: ${worsening.join(', ')}.`]
      : [],
    limitations: forecasts.length === 0
      ? ['No series has enough comparable dated observations for a six-month trend forecast.']
      : ['Forecasts continue observed linear trends and are not guarantees.'],
  })
}

export function buildExecutiveFallback(params: {
  collection: FinancialAnalysisCollection
  financialPosition: SpecialistAnalysisOutput
  trendForecast: SpecialistAnalysisOutput
  policy: FinancialPolicyEvaluation
}): FinancialAnalysisNarrative {
  return FinancialAnalysisNarrativeSchema.parse({
    executiveSummary: [
      params.financialPosition.summary,
      params.trendForecast.summary,
    ].join(' '),
    financialPosition: params.financialPosition.summary,
    trendAndForecast: params.trendForecast.summary,
    risks: [
      ...params.financialPosition.risks,
      ...params.trendForecast.risks,
      ...params.policy.rules
        .filter((rule) => rule.status === 'triggered' && rule.severity !== 'info')
        .map((rule) => rule.message),
    ].slice(0, 10),
    limitations: [
      ...params.collection.readiness.reasons,
      ...params.financialPosition.limitations,
      ...params.trendForecast.limitations,
    ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 10),
  })
}
