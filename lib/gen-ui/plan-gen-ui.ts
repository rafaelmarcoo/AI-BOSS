import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { calculateRunway } from '@/lib/calculations/runway'
import { CHAT_MODEL } from '@/lib/chat/system-prompt'
import {
  FINANCIAL_METRIC_KEYS,
  FINANCIAL_METRIC_LABELS,
} from '@/lib/financial-data/metric-keys'
import { getMetricNumber, isAvailableMetric } from '@/lib/financial-data/metrics'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import {
  getMetricObservationDate,
  readRunwayObservationHistory,
  type RunwayTrendSummary,
} from '@/lib/financial-data/runway-history'
import {
  GEN_UI_PLAN_VERSION,
  GEN_UI_WIDGET_TYPES,
  type GenUiPlan,
  type GenUiRunwayPoint,
  type GenUiSource,
  type GenUiWidget,
  type GenUiWidgetType,
} from '@/lib/gen-ui/types'
import type { AgentToolUsage } from '@/lib/ai/agent'
import type { SourceAwareMetricReadResult } from '@/lib/financial-data/read-model'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'

const CAUTION_THRESHOLD = 6
const URGENT_THRESHOLD = 3
const MAX_WIDGETS = 4

const PlannerWidgetSchema = z.object({
  type: z.enum(GEN_UI_WIDGET_TYPES),
  title: z.string().optional(),
  reason: z.string().optional(),
})

const PlannerOutputSchema = z.object({
  widgets: z.array(PlannerWidgetSchema).max(MAX_WIDGETS),
})

type PlannerWidget = z.infer<typeof PlannerWidgetSchema>

interface PlanGenUiParams {
  userId: string
  userMessage: string
  assistantMessage: string
  toolsUsed: AgentToolUsage[]
}

interface GenUiDataContext {
  snapshot: SourceAwareMetricReadResult
  runwayTrend: RunwayTrendSummary
  source: GenUiSource
  selectedText: string | null
  userMessage: string
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '-'
  }

  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined) {
    return '-'
  }

  return value.toFixed(decimals)
}

function widgetId(type: GenUiWidgetType, index: number) {
  return `${type}-${Date.now()}-${index}`
}

function extractSelectedText(userMessage: string) {
  const quotedMatch = userMessage.match(/"([^"]+)"/)

  return quotedMatch?.[1]?.trim() || null
}

function detectSource(userMessage: string): GenUiSource {
  return /\bdashboard highlight\b|\bhighlight\b/i.test(userMessage)
    ? 'selection'
    : 'chat'
}

function isDashboardRelevant(userMessage: string, source: GenUiSource) {
  if (source === 'selection') {
    return true
  }

  return /\b(runway|burn|cash|forecast|future|plan|planning|trend|scenario|what if|risk|expense|revenue|source|metric|data|cost|hire|saving|threshold)\b/i.test(
    userMessage
  )
}

function metricValueForPrompt(
  snapshot: SourceAwareMetricReadResult,
  key: FinancialMetricKey
) {
  return getMetricNumber(snapshot.metrics, key)
}

function listMissingMetrics(snapshot: SourceAwareMetricReadResult) {
  return FINANCIAL_METRIC_KEYS.filter(
    (key) => !isAvailableMetric(snapshot.metrics[key])
  )
}

function defaultWidgetSpecs(
  userMessage: string,
  snapshot: SourceAwareMetricReadResult,
  source: GenUiSource
): PlannerWidget[] {
  const normalized = userMessage.toLowerCase()
  const widgets: PlannerWidget[] = []
  const missingMetrics = listMissingMetrics(snapshot)

  if (source === 'selection') {
    widgets.push({
      type: 'highlight_explainer',
      title: 'Highlighted insight',
      reason: 'The user highlighted dashboard text and asked AI-BOSS to explain it.',
    })
  }

  if (/\b(future|forecast|plan|planning|trend|next|months?)\b/.test(normalized)) {
    widgets.push(
      {
        type: 'runway_trend_chart',
        title: 'Runway trend forecast',
        reason: 'The question is about future planning or trend direction.',
      },
      {
        type: 'risk_threshold_timeline',
        title: 'Risk threshold timing',
        reason: 'Runway planning needs caution and urgent threshold timing.',
      }
    )
  }

  if (/\b(scenario|what if|increase|decrease|hire|cut|saving|cost)\b/.test(normalized)) {
    widgets.push({
      type: 'scenario_comparison',
      title: 'Scenario comparison',
      reason: 'The user is exploring a possible change to monthly burn.',
    })
  }

  if (/\b(source|evidence|data|where|uploaded|metric)\b/.test(normalized)) {
    widgets.push({
      type: 'metric_source_evidence',
      title: 'Metric source evidence',
      reason: 'The user is asking about the data behind the answer.',
    })
  }

  if (/\b(runway|risk|burn|cash)\b/.test(normalized)) {
    widgets.push({
      type: 'planning_checklist',
      title: 'Planning checklist',
      reason: 'The user is asking for an actionable runway decision view.',
    })
  }

  if (missingMetrics.length > 0 && widgets.length > 0) {
    widgets.push({
      type: 'missing_data_panel',
      title: 'Missing data',
      reason: 'Some metrics are unavailable, so AI-BOSS should be explicit about data gaps.',
    })
  }

  if (widgets.length === 0 && /\b(runway|cash|burn)\b/.test(normalized)) {
    widgets.push({
      type: 'risk_threshold_timeline',
      title: 'Runway status',
      reason: 'The question is about a core runway metric.',
    })
  }

  return dedupeWidgetSpecs(widgets).slice(0, MAX_WIDGETS)
}

function dedupeWidgetSpecs(widgets: PlannerWidget[]) {
  const seen = new Set<GenUiWidgetType>()
  const deduped: PlannerWidget[] = []

  for (const widget of widgets) {
    if (seen.has(widget.type)) {
      continue
    }

    seen.add(widget.type)
    deduped.push(widget)
  }

  return deduped
}

function extractJsonObject(content: string) {
  const trimmed = content.trim()

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const match = trimmed.match(/\{[\s\S]*\}/)

  return match?.[0] ?? null
}

async function chooseWidgetsWithModel(params: {
  userMessage: string
  assistantMessage: string
  toolsUsed: AgentToolUsage[]
  snapshot: SourceAwareMetricReadResult
  runwayTrend: RunwayTrendSummary
  source: GenUiSource
}) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  const currentRunway = metricValueForPrompt(params.snapshot, 'runway_months')
  const monthlyBurn = metricValueForPrompt(params.snapshot, 'burn_rate')
  const cash = metricValueForPrompt(params.snapshot, 'cash')
  const missingMetrics = listMissingMetrics(params.snapshot).map(
    (key) => FINANCIAL_METRIC_LABELS[key]
  )

  const model = new ChatOpenAI({
    model: CHAT_MODEL,
    temperature: 0,
    apiKey,
  })
  const response = await model.invoke([
    new SystemMessage(
      [
        'You are a UI planner for AI-BOSS.',
        'Choose which right-side dashboard widgets should appear for the latest user question.',
        'Return JSON only. Do not include prose, markdown, or data values.',
        `Allowed widget types: ${GEN_UI_WIDGET_TYPES.join(', ')}.`,
        'Choose 0 to 4 widgets. Use empty widgets for unrelated small talk.',
        'Prefer runway_trend_chart and risk_threshold_timeline for future planning.',
        'Prefer scenario_comparison for what-if or cost-change questions.',
        'Prefer metric_source_evidence for source, evidence, or data questions.',
        'Prefer highlight_explainer when the source is selection.',
      ].join('\n')
    ),
    new HumanMessage(
      JSON.stringify({
        userMessage: params.userMessage,
        assistantMessage: params.assistantMessage,
        source: params.source,
        dataSummary: {
          currentRunway,
          monthlyBurn,
          cash,
          missingMetrics,
          runwayTrendDirection: params.runwayTrend.direction,
          toolsUsed: params.toolsUsed.map((tool) => tool.tool),
        },
        outputShape: {
          widgets: [
            {
              type: 'runway_trend_chart',
              title: 'short title',
              reason: 'why this widget helps',
            },
          ],
        },
      })
    ),
  ])
  const content =
    typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content)
  const json = extractJsonObject(content)

  if (!json) {
    return null
  }

  const parsedJson = JSON.parse(json) as unknown
  const parsed = PlannerOutputSchema.safeParse(parsedJson)

  return parsed.success ? parsed.data.widgets : null
}

function buildTrendPoints(context: GenUiDataContext): GenUiRunwayPoint[] {
  const currentRunway = getMetricNumber(
    context.snapshot.metrics,
    'runway_months'
  )
  const actualPoints = context.runwayTrend.observations.map((metric, index) => ({
    label: metric.asOfDate
      ? new Date(metric.asOfDate).toLocaleDateString('en-NZ', {
          month: 'short',
        })
      : `Obs ${index + 1}`,
    date: getMetricObservationDate(metric),
    runwayMonths: Number(metric.value.toFixed(1)),
    kind: 'actual' as const,
  }))

  if (actualPoints.length === 0 && currentRunway !== null) {
    actualPoints.push({
      label: 'Now',
      date: new Date().toISOString(),
      runwayMonths: Number(currentRunway.toFixed(1)),
      kind: 'actual',
    })
  }

  if (actualPoints.length === 0) {
    return []
  }

  const monthlyChange =
    context.runwayTrend.averageChange !== null
      ? context.runwayTrend.averageChange
      : -0.5
  const lastPoint = actualPoints[actualPoints.length - 1]
  const forecastPoints = Array.from({ length: 5 }, (_, index) => {
    const runwayMonths = Math.max(
      0,
      Number((lastPoint.runwayMonths + monthlyChange * (index + 1)).toFixed(1))
    )

    return {
      label: `+${index + 1}m`,
      date: null,
      runwayMonths,
      kind: 'forecast' as const,
    }
  })

  return [...actualPoints, ...forecastPoints]
}

function buildRunwayTrendWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget | null {
  const currentRunway = getMetricNumber(
    context.snapshot.metrics,
    'runway_months'
  )
  const points = buildTrendPoints(context)

  if (points.length === 0) {
    return null
  }

  return {
    id: widgetId(spec.type, index),
    type: 'runway_trend_chart',
    title: spec.title ?? 'Runway trend forecast',
    reason: spec.reason ?? 'AI-BOSS selected a trend view for this question.',
    data: {
      points,
      direction: context.runwayTrend.direction,
      currentRunway,
      averageMonthlyChange: context.runwayTrend.averageChange,
      cautionThreshold: CAUTION_THRESHOLD,
      urgentThreshold: URGENT_THRESHOLD,
      note:
        context.runwayTrend.averageChange === null
          ? 'Forecast points use a cautious placeholder slope until more runway history is available.'
          : 'Forecast points extend the observed average runway movement and should be treated as rough planning context.',
    },
  }
}

function buildScenarioComparisonWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget | null {
  const runwayInput = context.snapshot.runwayInput

  if (!runwayInput) {
    return null
  }

  const base = calculateRunway(runwayInput)
  const scenarioInputs = [
    {
      label: 'Burn +15%',
      burn: Number((runwayInput.burn * 1.15).toFixed(2)),
    },
    {
      label: 'Burn -10%',
      burn: Number((runwayInput.burn * 0.9).toFixed(2)),
    },
  ]
  const scenarios = scenarioInputs.map((scenario) => {
    const result = calculateRunway({
      ...runwayInput,
      burn: scenario.burn,
    })

    return {
      label: scenario.label,
      monthlyBurn: scenario.burn,
      runwayMonths: result.runway_months,
      deltaMonths: Number((result.runway_months - base.runway_months).toFixed(2)),
    }
  })

  return {
    id: widgetId(spec.type, index),
    type: 'scenario_comparison',
    title: spec.title ?? 'Scenario comparison',
    reason: spec.reason ?? 'AI-BOSS selected a scenario view for this question.',
    data: {
      base: {
        label: 'Current',
        monthlyBurn: runwayInput.burn,
        runwayMonths: base.runway_months,
      },
      scenarios,
      note: 'These scenarios are calculated from current runway inputs and do not update stored financial data.',
    },
  }
}

function buildPlanningChecklistWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget {
  const currentRunway = getMetricNumber(
    context.snapshot.metrics,
    'runway_months'
  )
  const monthlyBurn = getMetricNumber(context.snapshot.metrics, 'burn_rate')
  const missingMetrics = listMissingMetrics(context.snapshot)
  const items = [
    {
      label:
        currentRunway !== null && currentRunway < URGENT_THRESHOLD
          ? 'Treat runway as urgent'
          : 'Review runway buffer',
      detail:
        currentRunway !== null
          ? `Current runway is ${formatNumber(currentRunway)} months.`
          : 'Runway is unavailable, so collect cash, AR, AP, and burn first.',
      tone:
        currentRunway !== null && currentRunway < URGENT_THRESHOLD
          ? ('urgent' as const)
          : ('watch' as const),
    },
    {
      label: 'Pressure-test monthly burn',
      detail:
        monthlyBurn !== null
          ? `Use ${formatCurrency(monthlyBurn)} monthly burn as the current baseline.`
          : 'Monthly burn is missing, so scenario outputs will be limited.',
      tone: 'watch' as const,
    },
    {
      label: 'Close data gaps',
      detail:
        missingMetrics.length > 0
          ? `${missingMetrics.length} metric${missingMetrics.length === 1 ? '' : 's'} still need source data.`
          : 'Core runway metrics are available for planning.',
      tone: missingMetrics.length > 0 ? ('watch' as const) : ('steady' as const),
    },
  ]

  return {
    id: widgetId(spec.type, index),
    type: 'planning_checklist',
    title: spec.title ?? 'Planning checklist',
    reason: spec.reason ?? 'AI-BOSS selected actions to support the answer.',
    data: {
      items,
    },
  }
}

function buildRiskThresholdTimelineWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget {
  const currentRunway = getMetricNumber(
    context.snapshot.metrics,
    'runway_months'
  )
  const averageChange = context.runwayTrend.averageChange
  const decliningChange =
    averageChange !== null && averageChange < 0 ? Math.abs(averageChange) : null
  const monthsUntil = (threshold: number) => {
    if (currentRunway === null) {
      return null
    }

    if (currentRunway <= threshold) {
      return 0
    }

    if (decliningChange === null || decliningChange === 0) {
      return null
    }

    return Number(((currentRunway - threshold) / decliningChange).toFixed(1))
  }
  const monthsUntilCaution = monthsUntil(CAUTION_THRESHOLD)
  const monthsUntilUrgent = monthsUntil(URGENT_THRESHOLD)
  const status =
    currentRunway === null
      ? 'unknown'
      : currentRunway < URGENT_THRESHOLD
        ? 'urgent'
        : currentRunway < CAUTION_THRESHOLD
          ? 'caution'
          : 'healthy'
  const message =
    status === 'unknown'
      ? 'Runway status needs complete current metrics.'
      : status === 'urgent'
        ? 'Runway is already below the urgent threshold.'
        : status === 'caution'
          ? 'Runway is below the recommended buffer and should be watched closely.'
          : monthsUntilUrgent !== null
            ? `At the observed decline rate, urgent runway is roughly ${monthsUntilUrgent} months away.`
            : 'Current runway is above the caution threshold.'

  return {
    id: widgetId(spec.type, index),
    type: 'risk_threshold_timeline',
    title: spec.title ?? 'Risk threshold timing',
    reason: spec.reason ?? 'AI-BOSS selected threshold timing for this question.',
    data: {
      currentRunway,
      monthsUntilCaution,
      monthsUntilUrgent,
      status,
      message,
    },
  }
}

function buildMetricSourceEvidenceWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget {
  const priorityMetrics: FinancialMetricKey[] = [
    'cash',
    'burn_rate',
    'runway_months',
    'monthly_revenue',
    'monthly_expenses',
  ]
  const metrics = priorityMetrics.map((key) => {
    const metric = context.snapshot.metrics[key]

    if (isAvailableMetric(metric)) {
      const value =
        metric.currency === 'NZD' || key !== 'runway_months'
          ? formatCurrency(metric.value)
          : formatNumber(metric.value)

      return {
        label: FINANCIAL_METRIC_LABELS[key],
        value,
        sourceLabel: metric.provenance.sourceLabel,
        sourceType: metric.provenance.sourceType,
        confidence: metric.confidence,
        tone: 'available' as const,
      }
    }

    return {
      label: FINANCIAL_METRIC_LABELS[key],
      value: '-',
      sourceLabel: metric.sourceLabel ?? 'Unavailable',
      sourceType: metric.sourceType ?? 'none',
      confidence: null,
      tone: 'unavailable' as const,
    }
  })

  return {
    id: widgetId(spec.type, index),
    type: 'metric_source_evidence',
    title: spec.title ?? 'Metric source evidence',
    reason: spec.reason ?? 'AI-BOSS selected source context for this answer.',
    data: {
      metrics,
    },
  }
}

function buildMissingDataPanelWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget | null {
  const missingMetrics = listMissingMetrics(context.snapshot).map(
    (key) => FINANCIAL_METRIC_LABELS[key]
  )

  if (missingMetrics.length === 0) {
    return null
  }

  return {
    id: widgetId(spec.type, index),
    type: 'missing_data_panel',
    title: spec.title ?? 'Missing data',
    reason: spec.reason ?? 'AI-BOSS selected this because data gaps affect the answer.',
    data: {
      missingMetrics,
      message:
        'These metrics are unavailable, so AI-BOSS should avoid pretending the view is complete.',
    },
  }
}

function buildHighlightExplainerWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget {
  return {
    id: widgetId(spec.type, index),
    type: 'highlight_explainer',
    title: spec.title ?? 'Highlighted insight',
    reason: spec.reason ?? 'AI-BOSS selected this because the user highlighted text.',
    data: {
      selectedText: context.selectedText ?? 'Highlighted dashboard text',
      prompt: context.userMessage,
    },
  }
}

function hydrateWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget | null {
  switch (spec.type) {
    case 'runway_trend_chart':
      return buildRunwayTrendWidget(spec, index, context)
    case 'scenario_comparison':
      return buildScenarioComparisonWidget(spec, index, context)
    case 'planning_checklist':
      return buildPlanningChecklistWidget(spec, index, context)
    case 'risk_threshold_timeline':
      return buildRiskThresholdTimelineWidget(spec, index, context)
    case 'metric_source_evidence':
      return buildMetricSourceEvidenceWidget(spec, index, context)
    case 'missing_data_panel':
      return buildMissingDataPanelWidget(spec, index, context)
    case 'highlight_explainer':
      return buildHighlightExplainerWidget(spec, index, context)
  }
}

export async function planGenUi({
  userId,
  userMessage,
  assistantMessage,
  toolsUsed,
}: PlanGenUiParams): Promise<GenUiPlan | null> {
  const source = detectSource(userMessage)

  if (!isDashboardRelevant(userMessage, source)) {
    return null
  }

  const [snapshot, runwayTrend] = await Promise.all([
    readSourceAwareMetrics(userId),
    readRunwayObservationHistory(userId).catch(() => ({
      observations: [],
      direction: 'insufficient_data' as const,
      change: null,
      averageChange: null,
    })),
  ])
  const fallbackSpecs = defaultWidgetSpecs(userMessage, snapshot, source)
  const selectedText = extractSelectedText(userMessage)
  const modelSpecs = await chooseWidgetsWithModel({
    userMessage,
    assistantMessage,
    toolsUsed,
    snapshot,
    runwayTrend,
    source,
  }).catch(() => null)
  const specs = dedupeWidgetSpecs(
    modelSpecs && modelSpecs.length > 0 ? modelSpecs : fallbackSpecs
  )

  if (specs.length === 0) {
    return null
  }

  const context: GenUiDataContext = {
    snapshot,
    runwayTrend,
    source,
    selectedText,
    userMessage,
  }
  const widgets = specs
    .map((spec, index) => hydrateWidget(spec, index, context))
    .filter((widget): widget is GenUiWidget => widget !== null)

  if (widgets.length === 0) {
    return null
  }

  return {
    version: GEN_UI_PLAN_VERSION,
    source,
    generatedAt: new Date().toISOString(),
    summary:
      source === 'selection'
        ? 'Generated from the selected dashboard highlight.'
        : 'Generated from the latest AI-BOSS chat turn.',
    widgets: widgets.slice(0, MAX_WIDGETS),
  }
}
