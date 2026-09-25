import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  buildExecutiveFallback,
  buildFinancialPositionFallback,
  buildTrendForecastFallback,
  runExecutiveSynthesizer,
  runFinancialPositionAgent,
  runTrendForecastAgent,
  type SpecialistAnalysisOutput,
  type StructuredAnalysisAgentResult,
} from '@/lib/financial-analysis/agents'
import {
  collectFinancialAnalysis,
  FinancialAnalysisRequestSchema,
  type FinancialAnalysisCollection,
  type FinancialAnalysisRequest,
} from '@/lib/financial-analysis/collector'
import {
  evaluateCurrentRunwayPolicy,
  unavailableCurrentRunwayPolicy,
} from '@/lib/financial-analysis/policies'
import { selectFinancialRecommendations } from '@/lib/financial-analysis/recommendations'
import {
  FINANCIAL_ANALYSIS_RESULT_VERSION,
  FinancialAnalysisResultSchema,
  type FinancialAnalysisAgentTraceEntry,
  type FinancialAnalysisNarrative,
  type FinancialAnalysisResult,
} from '@/lib/financial-analysis/types'
import type { FinancialAnalysisRun } from '@/types/database'

const RunFinancialAnalysisInputSchema = z.object({
  userId: z.string().trim().min(1),
  request: FinancialAnalysisRequestSchema,
}).strict()

interface SaveFinancialAnalysisParams {
  userId: string
  result: FinancialAnalysisResult
  baselineFingerprint: Array<{ id: string; updatedAt: string }>
  modelMetadata: Record<string, unknown>
  tokenMetadata: Record<string, unknown>
}

export interface FinancialAnalysisOrchestratorDependencies {
  collect(params: {
    userId: string
    request: FinancialAnalysisRequest
  }): Promise<FinancialAnalysisCollection>
  runFinancialPosition(
    collection: FinancialAnalysisCollection
  ): Promise<StructuredAnalysisAgentResult<SpecialistAnalysisOutput>>
  runTrendForecast(
    collection: FinancialAnalysisCollection
  ): Promise<StructuredAnalysisAgentResult<SpecialistAnalysisOutput>>
  runExecutiveSynthesis(params: {
    collection: FinancialAnalysisCollection
    financialPosition: SpecialistAnalysisOutput
    trendForecast: SpecialistAnalysisOutput
    policy: FinancialAnalysisResult['policy']
    recommendations: FinancialAnalysisResult['recommendations']
  }): Promise<StructuredAnalysisAgentResult<FinancialAnalysisNarrative>>
  save(params: SaveFinancialAnalysisParams): Promise<FinancialAnalysisRun>
  now(): string
}

async function saveWithDefaultPersistence(params: SaveFinancialAnalysisParams) {
  const { saveFinancialAnalysisRun } = await import(
    '@/lib/financial-analysis/persistence'
  )
  return saveFinancialAnalysisRun(params)
}

const DEFAULT_DEPENDENCIES: FinancialAnalysisOrchestratorDependencies = {
  collect: collectFinancialAnalysis,
  runFinancialPosition: runFinancialPositionAgent,
  runTrendForecast: runTrendForecastAgent,
  runExecutiveSynthesis: runExecutiveSynthesizer,
  save: saveWithDefaultPersistence,
  now: () => new Date().toISOString(),
}

function collectionFingerprint(collection: FinancialAnalysisCollection) {
  return createHash('sha256')
    .update(JSON.stringify(collection.baselineFingerprint))
    .digest('hex')
}

function recommendationRunwayStatus(
  triggeredRuleIds: FinancialAnalysisResult['policy']['triggeredRuleIds']
) {
  if (triggeredRuleIds.includes('current_runway_urgent')) return 'urgent' as const
  if (triggeredRuleIds.includes('current_runway_caution')) return 'caution' as const
  if (triggeredRuleIds.includes('current_runway_healthy')) return 'healthy' as const
  return null
}

function agentTraceEntry(params: {
  step: FinancialAnalysisAgentTraceEntry['step']
  execution: FinancialAnalysisAgentTraceEntry['execution']
  startedAt: string
  completedAt: string
  model: string | null
  usedFallback?: boolean
  inputFingerprint: string
  warning?: string
}): FinancialAnalysisAgentTraceEntry {
  return {
    step: params.step,
    execution: params.execution,
    status: params.usedFallback ? 'completed_with_fallback' : 'completed',
    startedAt: params.startedAt,
    completedAt: params.completedAt,
    model: params.model,
    inputFingerprint: params.inputFingerprint,
    warnings: params.warning ? [params.warning] : [],
  }
}

function resolveSpecialist(params: {
  settled: PromiseSettledResult<StructuredAnalysisAgentResult<SpecialistAnalysisOutput>>
  fallback: SpecialistAnalysisOutput
  fallbackWarning: string
}) {
  return params.settled.status === 'fulfilled'
    ? { ...params.settled.value, usedFallback: false, warning: null }
    : {
        output: params.fallback,
        model: null,
        tokensUsed: null,
        usedFallback: true,
        warning: params.fallbackWarning,
      }
}

export async function runFinancialAnalysis(
  rawInput: {
    userId: string
    request: unknown
  },
  dependencyOverrides: Partial<FinancialAnalysisOrchestratorDependencies> = {}
) {
  const input = RunFinancialAnalysisInputSchema.parse(rawInput)
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides }
  const trace: FinancialAnalysisAgentTraceEntry[] = []
  const collectionStartedAt = dependencies.now()
  const collection = await dependencies.collect(input)
  const collectionCompletedAt = dependencies.now()
  const fingerprint = collectionFingerprint(collection)
  trace.push(agentTraceEntry({
    step: 'collector',
    execution: 'deterministic',
    startedAt: collectionStartedAt,
    completedAt: collectionCompletedAt,
    model: null,
    inputFingerprint: fingerprint,
  }))

  const specialistsStartedAt = dependencies.now()
  const [financialPositionSettled, trendForecastSettled] = await Promise.allSettled([
    dependencies.runFinancialPosition(collection),
    dependencies.runTrendForecast(collection),
  ])
  const specialistsCompletedAt = dependencies.now()
  const financialPosition = resolveSpecialist({
    settled: financialPositionSettled,
    fallback: buildFinancialPositionFallback(collection),
    fallbackWarning: 'Financial Position Agent failed; deterministic narrative fallback used.',
  })
  const trendForecast = resolveSpecialist({
    settled: trendForecastSettled,
    fallback: buildTrendForecastFallback(collection),
    fallbackWarning: 'Trend and Forecast Agent failed; deterministic narrative fallback used.',
  })
  trace.push(
    agentTraceEntry({
      step: 'financial_position_agent',
      execution: 'model',
      startedAt: specialistsStartedAt,
      completedAt: specialistsCompletedAt,
      model: financialPosition.model,
      usedFallback: financialPosition.usedFallback,
      inputFingerprint: fingerprint,
      warning: financialPosition.warning ?? undefined,
    }),
    agentTraceEntry({
      step: 'trend_forecast_agent',
      execution: 'model',
      startedAt: specialistsStartedAt,
      completedAt: specialistsCompletedAt,
      model: trendForecast.model,
      usedFallback: trendForecast.usedFallback,
      inputFingerprint: fingerprint,
      warning: trendForecast.warning ?? undefined,
    })
  )

  const policyStartedAt = dependencies.now()
  const policy = collection.facts.runway
    ? evaluateCurrentRunwayPolicy(collection.facts.runway.cashRunwayMonths)
    : unavailableCurrentRunwayPolicy()
  const cashTrend = collection.facts.history.find(
    (fact) => fact.metricKey === 'cash'
  )?.direction ?? 'insufficient_data'
  const burnTrend = collection.facts.history.find(
    (fact) => fact.metricKey === 'burn_rate'
  )?.direction ?? 'insufficient_data'
  const recommendations = selectFinancialRecommendations({
    readinessStatus: collection.readiness.status,
    missingMetricKeys: collection.readiness.missingMetricKeys,
    runwayStatus: recommendationRunwayStatus(policy.triggeredRuleIds),
    operatingBalance: collection.facts.operatingBalance?.operatingBalance ?? null,
    cashTrend,
    burnTrend,
    workingCapitalPosition: collection.facts.receivablesPayables?.position ?? null,
  })
  const policyCompletedAt = dependencies.now()
  trace.push(agentTraceEntry({
    step: 'policy_engine',
    execution: 'deterministic',
    startedAt: policyStartedAt,
    completedAt: policyCompletedAt,
    model: null,
    inputFingerprint: fingerprint,
  }))

  const synthesisStartedAt = dependencies.now()
  let synthesis: StructuredAnalysisAgentResult<FinancialAnalysisNarrative>
  let synthesisUsedFallback = false
  let synthesisWarning: string | undefined
  try {
    synthesis = await dependencies.runExecutiveSynthesis({
      collection,
      financialPosition: financialPosition.output,
      trendForecast: trendForecast.output,
      policy,
      recommendations,
    })
  } catch {
    synthesisUsedFallback = true
    synthesisWarning = 'Executive Synthesizer failed; deterministic narrative fallback used.'
    synthesis = {
      output: buildExecutiveFallback({
        collection,
        financialPosition: financialPosition.output,
        trendForecast: trendForecast.output,
        policy,
      }),
      model: null,
      tokensUsed: null,
    }
  }
  const synthesisCompletedAt = dependencies.now()
  trace.push(agentTraceEntry({
    step: 'executive_synthesizer',
    execution: 'model',
    startedAt: synthesisStartedAt,
    completedAt: synthesisCompletedAt,
    model: synthesis.model,
    usedFallback: synthesisUsedFallback,
    inputFingerprint: fingerprint,
    warning: synthesisWarning,
  }))

  const fallbackUsed =
    financialPosition.usedFallback ||
    trendForecast.usedFallback ||
    synthesisUsedFallback
  const result = FinancialAnalysisResultSchema.parse({
    version: FINANCIAL_ANALYSIS_RESULT_VERSION,
    runStatus: fallbackUsed ? 'completed_with_fallback' : 'complete',
    generatedAt: dependencies.now(),
    selectedBaseline: {
      mode: collection.selection.mode,
      sourceKey: collection.selection.sourceKey,
      sourceLabel: collection.selection.sourceLabel,
      currency: collection.selection.currency,
      sources: collection.selection.sources,
      reportingPeriodStart: collection.selection.reportingPeriodStart,
      reportingPeriodEnd: collection.selection.reportingPeriodEnd,
      reportDate: collection.selection.reportDate,
    },
    readiness: collection.readiness,
    sections: collection.sections,
    facts: collection.facts,
    narrative: synthesis.output,
    evidence: collection.evidence,
    assumptions: collection.assumptions,
    agentTrace: { fallbackUsed, entries: trace },
    policy,
    recommendations,
  })
  const modelSteps = [
    ['financial_position_agent', financialPosition],
    ['trend_forecast_agent', trendForecast],
    ['executive_synthesizer', {
      ...synthesis,
      usedFallback: synthesisUsedFallback,
    }],
  ] as const
  const knownTokens = modelSteps.flatMap(([, step]) =>
    step.tokensUsed === null ? [] : [step.tokensUsed]
  )

  return dependencies.save({
    userId: input.userId,
    result,
    baselineFingerprint: collection.baselineFingerprint,
    modelMetadata: {
      agents: modelSteps.map(([step, metadata]) => ({
        step,
        model: metadata.model,
        fallbackUsed: metadata.usedFallback,
      })),
    },
    tokenMetadata: {
      totalTokens: knownTokens.length > 0
        ? knownTokens.reduce((total, value) => total + value, 0)
        : null,
      complete: knownTokens.length === modelSteps.length,
      byStep: Object.fromEntries(
        modelSteps.map(([step, metadata]) => [step, metadata.tokensUsed])
      ),
    },
  })
}
