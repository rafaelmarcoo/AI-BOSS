import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { CHAT_MODEL, mainModelOptions } from '@/lib/ai/model-config'
import {
  FINANCIAL_METRIC_KEYS,
  FINANCIAL_METRIC_LABELS,
} from '@/lib/financial-data/metric-keys'
import { getMetricNumber, isAvailableMetric } from '@/lib/financial-data/metrics'
import {
  formatFinancialCurrency,
  isSupportedFinancialCurrency,
} from '@/lib/financial-data/currency'
import { readSourceAwareMetrics } from '@/lib/financial-data/read-service'
import {
  readRunwayObservationHistory,
  type RunwayTrendSummary,
} from '@/lib/financial-data/runway-history'
import {
  readFinancialMetricHistorySeries,
  type HistoricalMetricKey,
  type MetricHistorySummary,
} from '@/lib/financial-data/metric-history'
import {
  readFinancialMetricForecastSeries,
  type ForecastHorizon,
  type MetricForecastSummary,
} from '@/lib/financial-data/metric-forecast'
import {
  GEN_UI_PLAN_VERSION,
  GEN_UI_WIDGET_TYPES,
  type GenUiPlan,
  type GenUiSource,
  type GenUiWidget,
  type GenUiWidgetType,
  type MetricSnapshotWidget,
  type GenUiMetricCalculationRole,
  type GenUiMetricDateStatus,
} from '@/lib/gen-ui/types'
import type { AgentToolExecution, AgentToolUsage } from '@/lib/ai/agent'
import type { SourceAwareMetricReadResult } from '@/lib/financial-data/read-model'
import type { FinancialMetricKey } from '@/lib/financial-data/metric-keys'
import { describeGenUiWidgetCatalog } from '@/lib/gen-ui/catalog'
import {
  isDataConnectionRequest,
  selectMetricKeysForMessage,
} from '@/lib/gen-ui/selection'
import {
  isScenarioAnalysisResult,
  type ScenarioAnalysisResult,
} from '@/lib/scenarios/calculation'

const CAUTION_THRESHOLD = 6
const URGENT_THRESHOLD = 3
const MAX_WIDGETS = 4

const ModelPlannerWidgetSchema = z.object({
  type: z.enum(GEN_UI_WIDGET_TYPES).describe('The widget to display.'),
  title: z.string().nullable().describe('A short widget title, or null to use the default.'),
  reason: z
    .string()
    .nullable()
    .describe('A concise user-facing explanation of why AI-BOSS chose this widget for the request, or null.'),
  metricKeys: z
    .array(z.enum(FINANCIAL_METRIC_KEYS))
    .max(4)
    .nullable()
    .describe('Relevant metric keys for metric_snapshot only; otherwise null.'),
})

const PlannerOutputSchema = z.object({
  widgets: z
    .array(ModelPlannerWidgetSchema)
    .max(MAX_WIDGETS)
    .describe('The relevant widgets, or an empty array when none would help.'),
}).describe('The right-side widget plan for the latest AI-BOSS request.')

interface PlannerWidget {
  type: GenUiWidgetType
  title?: string
  reason?: string
  metricKeys?: FinancialMetricKey[]
}

interface PlanGenUiParams {
  userId: string
  userMessage: string
  assistantMessage: string
  toolsUsed: AgentToolUsage[]
  toolExecutions?: AgentToolExecution[]
  scenarioMode?: boolean
  hasUnreviewedDocumentEvidence?: boolean
  unreviewedDocumentIds?: string[]
}

interface GenUiDataContext {
  snapshot: SourceAwareMetricReadResult
  runwayTrend: RunwayTrendSummary
  source: GenUiSource
  selectedText: string | null
  userMessage: string
  metricHistories: MetricHistorySummary[]
  metricForecasts: MetricForecastSummary[]
  scenarioResult: ScenarioAnalysisResult | null
}

function metricReportingDate(
  metric: SourceAwareMetricReadResult['metrics'][FinancialMetricKey]
) {
  return isAvailableMetric(metric)
    ? metric.asOfDate ?? metric.periodEnd ?? metric.periodStart
    : null
}

function runwayReferenceDate(snapshot: SourceAwareMetricReadResult) {
  const runway = snapshot.metrics.runway_months
  const cash = snapshot.metrics.cash

  return metricReportingDate(runway) ?? metricReportingDate(cash)
}

function metricDisplayContext(params: {
  key: FinancialMetricKey
  context: GenUiDataContext
  adjustedRunway?: boolean
}) {
  const metric = params.adjustedRunway
    ? params.context.snapshot.workingCapitalAdjustedRunway
    : params.context.snapshot.metrics[params.key]
  const runwayQuestion = /\brunway\b/i.test(params.context.userMessage)
  const referenceDate = runwayReferenceDate(params.context.snapshot)

  if (!isAvailableMetric(metric)) {
    return {
      reportingDate: params.adjustedRunway ? referenceDate : null,
      dateStatus: (params.adjustedRunway && referenceDate
        ? 'unavailable_for'
        : 'undated') as GenUiMetricDateStatus,
      calculationRole: 'unavailable' as GenUiMetricCalculationRole,
      detail: metric.detail ?? metric.sourceLabel ?? 'Unavailable',
    }
  }

  const reportingDate = metricReportingDate(metric)
  const calculated =
    params.key === 'runway_months' &&
    metric.provenance.sourceLabel.includes('calculated')

  let calculationRole: GenUiMetricCalculationRole | undefined
  let detail: string | null = null

  if (calculated) {
    calculationRole = 'derived'
  } else if (runwayQuestion) {
    const matchesReferenceDate =
      reportingDate !== null && reportingDate === referenceDate

    if (params.key === 'cash' || params.key === 'burn_rate') {
      calculationRole = matchesReferenceDate ? 'used' : 'context_only'
    } else if (
      params.key === 'accounts_receivable' ||
      params.key === 'accounts_payable'
    ) {
      calculationRole = matchesReferenceDate
        ? 'compatible_input'
        : 'context_only'
    } else {
      calculationRole = 'context_only'
    }

    if (
      calculationRole === 'context_only' &&
      reportingDate &&
      referenceDate &&
      reportingDate !== referenceDate
    ) {
      detail = `Does not match the ${referenceDate} runway calculation date.`
    }
  }

  return {
    reportingDate,
    dateStatus: (reportingDate
      ? calculated
        ? 'calculated_for'
        : 'latest_recorded'
      : 'undated') as GenUiMetricDateStatus,
    ...(calculationRole ? { calculationRole } : {}),
    detail,
  }
}

function historicalMetricKeyForMessage(userMessage: string): HistoricalMetricKey | null {
  const normalized = userMessage.toLowerCase()
  const isHistorical = /\b(history|historical|changed?|increase|decrease|improv|worsen|declin|past|over time|trend)\b/.test(normalized)

  if (!isHistorical) return null
  if (/\brunway\b/.test(normalized)) return 'runway_months'
  if (/\bcash\b/.test(normalized)) return 'cash'
  if (/\bburn\b/.test(normalized)) return 'burn_rate'
  if (/\brevenue|income\b/.test(normalized)) return 'monthly_revenue'
  if (/\bexpense|cost\b/.test(normalized)) return 'monthly_expenses'

  return null
}

function forecastMetricKeyForMessage(userMessage: string): HistoricalMetricKey | null {
  if (!/\b(future|forecast|project|next|months?)\b/.test(userMessage.toLowerCase())) {
    return null
  }

  if (/\brunway\b/i.test(userMessage)) return 'runway_months'
  if (/\bcash\b/i.test(userMessage)) return 'cash'
  if (/\bburn\b/i.test(userMessage)) return 'burn_rate'
  if (/\brevenue|income\b/i.test(userMessage)) return 'monthly_revenue'
  if (/\bexpense|cost\b/i.test(userMessage)) return 'monthly_expenses'

  return null
}

function forecastHorizonForMessage(userMessage: string): ForecastHorizon {
  return /\b6\s*(?:months?|m)\b/i.test(userMessage) ? 6 : 3
}

function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined
) {
  if (value === null || value === undefined) {
    return '-'
  }

  if (!isSupportedFinancialCurrency(currency)) {
    return currency ? `${currency} not supported` : 'Currency not provided'
  }

  return formatFinancialCurrency(value, currency)
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

  const metricKeys = selectMetricKeysForMessage(userMessage)
  const historicalMetricKey = historicalMetricKeyForMessage(userMessage)
  const forecastMetricKey = forecastMetricKeyForMessage(userMessage)

  if (historicalMetricKey) {
    widgets.push({
      type: 'metric_trend_chart',
      title: `Historical ${FINANCIAL_METRIC_LABELS[historicalMetricKey]} trend`,
      reason: 'The question asks how one financial metric has changed over time.',
    })
  }

  if (forecastMetricKey) {
    widgets.push({
      type: 'metric_forecast_chart',
      title: `${FINANCIAL_METRIC_LABELS[forecastMetricKey]} forecast`,
      reason: 'The question asks for a future estimate of one financial metric.',
    })
  }

  if (metricKeys.length > 0) {
    widgets.push({
      type: 'metric_snapshot',
      title: 'Relevant metrics',
      reason: 'These live metrics directly support the user question.',
      metricKeys,
    })
  }

  if (isDataConnectionRequest(userMessage)) {
    widgets.push({
      type: 'data_connections',
      title: 'Document sources',
      reason: 'The user is asking about supplying or reviewing financial files.',
    })
  }

  if (/\b(future|forecast|plan|planning|next|months?)\b/.test(normalized)) {
    if (forecastMetricKey === 'runway_months') {
      widgets.push({
        type: 'risk_threshold_timeline',
        title: 'Risk threshold timing',
        reason: 'Runway planning needs caution and urgent threshold timing.',
      })
    }
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
  const adjustedRunway = isAvailableMetric(
    params.snapshot.workingCapitalAdjustedRunway
  )
    ? params.snapshot.workingCapitalAdjustedRunway.value
    : null
  const monthlyBurn = metricValueForPrompt(params.snapshot, 'burn_rate')
  const cash = metricValueForPrompt(params.snapshot, 'cash')
  const missingMetrics = listMissingMetrics(params.snapshot).map(
    (key) => FINANCIAL_METRIC_LABELS[key]
  )

  const model = new ChatOpenAI({
    model: CHAT_MODEL,
    ...mainModelOptions(),
    apiKey,
  })
  const planner = model.withStructuredOutput(PlannerOutputSchema, {
    name: 'plan_dashboard_widgets',
    method: 'jsonSchema',
    strict: true,
  })
  const response = await planner.invoke([
    new SystemMessage(
      [
        'You are a UI planner for AI-BOSS.',
        'Choose which right-side dashboard widgets should appear for the latest user question.',
        `Allowed widget types: ${GEN_UI_WIDGET_TYPES.join(', ')}.`,
        'Choose 0 to 4 widgets. Use empty widgets for unrelated small talk.',
        'For metric_snapshot, return metricKeys with no more than four allowed metric keys.',
        'Return null metricKeys for other widget types.',
        'A widget must add useful visual or actionable context beyond the chat answer.',
        'For every selected widget, write a concise reason explaining why AI-BOSS chose it for this specific request.',
        'The reason will be shown directly under that widget in the generated UI.',
        describeGenUiWidgetCatalog(),
      ].join('\n')
    ),
    new HumanMessage(
      JSON.stringify({
        userMessage: params.userMessage,
        assistantMessage: params.assistantMessage,
        source: params.source,
        dataSummary: {
          currentRunway,
          workingCapitalAdjustedRunway: adjustedRunway,
          monthlyBurn,
          cash,
          missingMetrics,
          runwayTrendDirection: params.runwayTrend.direction,
          toolsUsed: params.toolsUsed.map((tool) => tool.tool),
        },
        outputShape: {
          widgets: [
            {
              type: 'metric_forecast_chart',
              title: 'short title',
              reason: 'why AI-BOSS chose this widget for the request',
              metricKeys: null,
            },
          ],
        },
      })
    ),
  ])
  return response.widgets.map((widget) => ({
    type: widget.type,
    ...(widget.title ? { title: widget.title } : {}),
    ...(widget.reason ? { reason: widget.reason } : {}),
    ...(widget.metricKeys && widget.metricKeys.length > 0
      ? { metricKeys: widget.metricKeys }
      : {}),
  }))
}

function buildMetricSnapshotWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget {
  const runwayQuestion = /\brunway\b/i.test(context.userMessage)
  const requestedKeys = [...new Set(spec.metricKeys ?? [])]
  const runwayCoreKeys = [
    'cash',
    'burn_rate',
    'runway_months',
  ] satisfies FinancialMetricKey[]
  const runwaySupportingKeys = new Set<FinancialMetricKey>([
    'accounts_receivable',
    'accounts_payable',
  ])
  const requestedRunwaySupportingKeys = requestedKeys.filter((key) =>
    runwaySupportingKeys.has(key)
  )
  const selectedKeys = runwayQuestion
    ? [
        ...runwayCoreKeys,
        ...requestedRunwaySupportingKeys,
        'accounts_receivable' as const,
        'accounts_payable' as const,
      ]
        .filter((key, keyIndex, keys) => keys.indexOf(key) === keyIndex)
        .slice(0, 3)
    : requestedKeys.length > 0
      ? requestedKeys.slice(0, 4)
      : (['runway_months', 'cash', 'burn_rate'] satisfies FinancialMetricKey[])
  const metrics: MetricSnapshotWidget['data']['metrics'] = selectedKeys.map((key) => {
    const metric = context.snapshot.metrics[key]
    const displayContext = metricDisplayContext({ key, context })

    if (!isAvailableMetric(metric)) {
      return {
        key,
        label: key === 'runway_months' ? 'Cash runway' : FINANCIAL_METRIC_LABELS[key],
        value: '-',
        unit: key === 'runway_months' ? 'months' : null,
        sourceLabel: metric.sourceLabel ?? 'Unavailable',
        sourceTone: 'unavailable' as const,
        ...displayContext,
      }
    }

    const sourceLabel =
      metric.provenance.sourceType === 'document'
        ? `Document: ${metric.provenance.sourceLabel}`
        : metric.provenance.sourceType === 'demo'
          ? `Demo: ${metric.provenance.sourceLabel}`
          : metric.provenance.sourceLabel

    return {
      key,
      label: key === 'runway_months' ? 'Cash runway' : FINANCIAL_METRIC_LABELS[key],
      value:
        key === 'runway_months'
          ? formatNumber(metric.value, 2)
          : formatCurrency(metric.value, metric.currency),
      unit: key === 'runway_months' ? 'months' : null,
      sourceLabel,
      sourceTone:
        displayContext.calculationRole === 'derived'
          ? ('derived' as const)
          : ('available' as const),
      ...displayContext,
    }
  })

  if (runwayQuestion) {
    const adjusted = context.snapshot.workingCapitalAdjustedRunway
    const adjustedContext = metricDisplayContext({
      key: 'runway_months',
      context,
      adjustedRunway: true,
    })

    metrics.push(
      isAvailableMetric(adjusted)
        ? {
            key: 'runway_months',
            runwayVariant: 'working_capital_adjusted',
            label: 'Working-capital-adjusted runway',
            value: formatNumber(adjusted.value, 2),
            unit: 'months',
            sourceLabel: adjusted.provenance.sourceLabel,
            sourceTone: 'derived',
            ...adjustedContext,
          }
        : {
            key: 'runway_months',
            runwayVariant: 'working_capital_adjusted',
            label: 'Working-capital-adjusted runway',
            value: '-',
            unit: 'months',
            sourceLabel: adjusted.sourceLabel ?? 'Unavailable',
            sourceTone: 'unavailable',
            ...adjustedContext,
          }
    )
  }

  return {
    id: widgetId(spec.type, index),
    type: 'metric_snapshot',
    title: spec.title ?? 'Relevant metrics',
    reason:
      'Shows the latest recorded values, their reporting dates, and whether each value was used, derived, contextual, or unavailable for this request.',
    data: { metrics },
  }
}

function buildDataConnectionsWidget(
  spec: PlannerWidget,
  index: number
): GenUiWidget {
  return {
    id: widgetId(spec.type, index),
    type: 'data_connections',
    title: spec.title ?? 'Document sources',
    reason: spec.reason ?? 'AI-BOSS selected supported document sources for this request.',
    data: {
      message: 'Upload or review the financial files that provide context to AI-BOSS.',
    },
  }
}

function buildMetricTrendWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
  selectedHistory?: MetricHistorySummary
): GenUiWidget | null {
  const history = selectedHistory ?? context.metricHistories[0]

  if (!history || history.points.length < 2 || history.hasIncompatibleCurrencies) {
    return null
  }

  const runwaySeries = history.metricKey === 'runway_months'
    ? context.metricHistories
        .filter(
          (series) =>
            series.metricKey === 'runway_months' &&
            series.runwayVariant &&
            series.seriesKey === history.seriesKey &&
            series.currency === history.currency
        )
        .map((series) => ({
          variant: series.runwayVariant as 'cash' | 'working_capital_adjusted',
          label: series.label,
          points: series.points.map((point) => ({
            date: point.date,
            value: point.value,
            sourceLabel: point.sourceLabel,
            confidence: point.confidence,
          })),
        }))
    : undefined

  return {
    id: widgetId(spec.type, index),
    type: 'metric_trend_chart',
    title: spec.title
      ? `${spec.title}${history.metricKey === 'runway_months' ? '' : ` (${history.currency})`}`
      : `Historical ${history.label} trend${history.metricKey === 'runway_months' ? '' : ` (${history.currency})`}`,
    reason: spec.reason ?? 'AI-BOSS selected a deterministic historical trend for this question.',
    data: {
      metricKey: history.metricKey,
      label: history.label,
      currency: history.currency,
      points: history.points.map((point) => ({
        date: point.date,
        value: point.value,
        sourceLabel: point.sourceLabel,
        confidence: point.confidence,
      })),
      direction: history.direction,
      totalChange: history.totalChange,
      hasMixedSources: history.hasMixedSources,
      hasRecordedDateFallback: history.hasRecordedDateFallback,
      note: [
        history.hasMixedSources
          ? `This trend combines sources: ${history.sourceLabels.join(', ')}.`
          : 'Values are based on stored financial observations.',
        history.excludedCurrencyObservationCount > 0
          ? `${history.excludedCurrencyObservationCount} observation(s) with missing or unsupported currency were excluded.`
          : null,
      ].filter(Boolean).join(' '),
      ...(runwaySeries && runwaySeries.length > 0 ? { runwaySeries } : {}),
    },
  }
}

function buildMetricForecastWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
  selectedForecast?: MetricForecastSummary
): GenUiWidget | null {
  const forecast = selectedForecast ?? context.metricForecasts[0]

  if (!forecast || forecast.forecastPoints.length === 0 || forecast.monthlySlope === null) {
    return null
  }

  const runwaySeries = forecast.metricKey === 'runway_months'
    ? context.metricForecasts
        .filter(
          (series) =>
            series.metricKey === 'runway_months' &&
            series.history.runwayVariant &&
            series.history.seriesKey === forecast.history.seriesKey &&
            series.history.currency === forecast.history.currency
        )
        .map((series) => ({
          variant: series.history.runwayVariant as 'cash' | 'working_capital_adjusted',
          label: series.label,
          actualPoints: series.history.points.map((point) => ({
            date: point.date,
            value: point.value,
            sourceLabel: point.sourceLabel,
            confidence: point.confidence,
          })),
          forecastPoints: series.forecastPoints.map(({ date, value }) => ({ date, value })),
        }))
    : undefined

  return {
    id: widgetId(spec.type, index),
    type: 'metric_forecast_chart',
    title: spec.title
      ? `${spec.title}${forecast.metricKey === 'runway_months' ? '' : ` (${forecast.history.currency})`}`
      : `${forecast.label} forecast${forecast.metricKey === 'runway_months' ? '' : ` (${forecast.history.currency})`}`,
    reason: spec.reason ?? 'AI-BOSS selected a deterministic forecast for this question.',
    data: {
      metricKey: forecast.metricKey,
      label: forecast.label,
      currency: forecast.history.currency,
      actualPoints: forecast.history.points.map((point) => ({
        date: point.date,
        value: point.value,
        sourceLabel: point.sourceLabel,
        confidence: point.confidence,
      })),
      forecastPoints: forecast.forecastPoints.map(({ date, value }) => ({ date, value })),
      horizon: forecast.horizon,
      monthlySlope: forecast.monthlySlope,
      hasMixedSources: forecast.history.hasMixedSources,
      hasRecordedDateFallback: forecast.history.hasRecordedDateFallback,
      note: forecast.assumptions.join(' '),
      ...(runwaySeries && runwaySeries.length > 0 ? { runwaySeries } : {}),
    },
  }
}

function buildScenarioAnalysisWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget | null {
  if (!context.scenarioResult) return null

  return {
    id: widgetId(spec.type, index),
    type: 'scenario_analysis',
    title: spec.title ?? 'Scenario analysis',
    reason: spec.reason ?? 'This view uses the exact deterministic result returned to the chat assistant.',
    data: {
      result: context.scenarioResult,
      editHref: '/dashboard/scenarios',
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
  const burnMetric = context.snapshot.metrics.burn_rate
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
          : 'Cash runway is unavailable, so collect compatible cash and burn first.',
      tone:
        currentRunway !== null && currentRunway < URGENT_THRESHOLD
          ? ('urgent' as const)
          : ('watch' as const),
    },
    {
      label: 'Pressure-test monthly burn',
      detail:
        monthlyBurn !== null
          ? `Use ${formatCurrency(
              monthlyBurn,
              isAvailableMetric(burnMetric) ? burnMetric.currency : null
            )} monthly burn as the current baseline.`
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
  const workingCapitalAdjustedRunway = isAvailableMetric(
    context.snapshot.workingCapitalAdjustedRunway
  )
    ? context.snapshot.workingCapitalAdjustedRunway.value
    : null
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
      workingCapitalAdjustedRunway,
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
  const runwayQuestion = /\brunway\b/i.test(context.userMessage)
  const priorityMetrics: FinancialMetricKey[] = runwayQuestion
    ? [
        'cash',
        'accounts_receivable',
        'accounts_payable',
        'burn_rate',
        'runway_months',
      ]
    : [
        'cash',
        'burn_rate',
        'runway_months',
        'monthly_revenue',
        'monthly_expenses',
      ]
  const metrics = priorityMetrics.map((key) => {
    const metric = context.snapshot.metrics[key]
    const displayContext = metricDisplayContext({ key, context })

    if (isAvailableMetric(metric)) {
      const value =
        key === 'runway_months'
          ? `${formatNumber(metric.value, 2)} months`
          : formatCurrency(metric.value, metric.currency)
      const isCalculatedRunway =
        key === 'runway_months' &&
        metric.provenance.sourceLabel.includes('cash runway calculated')

      return {
        label: key === 'runway_months' ? 'Cash runway' : FINANCIAL_METRIC_LABELS[key],
        value,
        sourceLabel: metric.provenance.sourceLabel,
        sourceType: metric.provenance.sourceType,
        confidence: metric.confidence,
        tone: isCalculatedRunway ? ('derived' as const) : ('available' as const),
        ...displayContext,
      }
    }

    return {
      label: key === 'runway_months' ? 'Cash runway' : FINANCIAL_METRIC_LABELS[key],
      value: '-',
      sourceLabel: metric.sourceLabel ?? 'Unavailable',
      sourceType: metric.sourceType ?? 'none',
      confidence: null,
      tone: 'unavailable' as const,
      ...displayContext,
    }
  })
  const adjustedRunway = context.snapshot.workingCapitalAdjustedRunway
  const adjustedDisplayContext = metricDisplayContext({
    key: 'runway_months',
    context,
    adjustedRunway: true,
  })
  metrics.push(
    isAvailableMetric(adjustedRunway)
      ? {
          label: 'Working-capital-adjusted runway',
          value: `${formatNumber(adjustedRunway.value, 2)} months`,
          sourceLabel: adjustedRunway.provenance.sourceLabel,
          sourceType: adjustedRunway.provenance.sourceType,
          confidence: adjustedRunway.confidence,
          tone: 'derived' as const,
          ...adjustedDisplayContext,
        }
      : {
          label: 'Working-capital-adjusted runway',
          value: '-',
          sourceLabel:
            adjustedRunway.sourceLabel ?? 'Unavailable',
          sourceType: adjustedRunway.sourceType ?? 'none',
          confidence: null,
          tone: 'unavailable' as const,
          ...adjustedDisplayContext,
        }
  )

  return {
    id: widgetId(spec.type, index),
    type: 'metric_source_evidence',
    title: spec.title ?? 'Metric source evidence',
    reason:
      "Shows each value's source, reporting date, and whether it was used, derived, contextual, or unavailable for this calculation.",
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
    case 'metric_snapshot':
      return buildMetricSnapshotWidget(spec, index, context)
    case 'data_connections':
      return buildDataConnectionsWidget(spec, index)
    case 'metric_trend_chart':
      return buildMetricTrendWidget(spec, index, context)
    case 'metric_forecast_chart':
      return buildMetricForecastWidget(spec, index, context)
    case 'scenario_comparison':
      // Retained only so persisted legacy messages continue to render. New
      // plans must use the exact structured tool result below.
      return null
    case 'scenario_analysis':
      return buildScenarioAnalysisWidget(spec, index, context)
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
  toolExecutions = [],
  scenarioMode = false,
  hasUnreviewedDocumentEvidence = false,
  unreviewedDocumentIds = [],
}: PlanGenUiParams): Promise<GenUiPlan | null> {
  const source = detectSource(userMessage)
  const scenarioResult = toolExecutions.flatMap((execution) => {
    if (execution.tool !== 'model_scenario' || !execution.result || typeof execution.result !== 'object') {
      return []
    }
    const toolResult = execution.result as { status?: unknown; result?: unknown }
    return toolResult.status === 'ready' && isScenarioAnalysisResult(toolResult.result)
      ? [toolResult.result]
      : []
  }).at(-1) ?? null

  // Scenario UI must never be inferred from prose. Without a validated tool
  // result there is no trusted financial result to visualise.
  if (scenarioMode) {
    if (!scenarioResult) return null
    return {
      version: GEN_UI_PLAN_VERSION,
      source,
      generatedAt: new Date().toISOString(),
      summary: 'Generated from the deterministic scenario calculation.',
      widgets: [{
        id: widgetId('scenario_analysis', 0),
        type: 'scenario_analysis',
        title: 'Scenario analysis',
        reason: 'This comparison uses the exact deterministic scenario result returned to AI-BOSS.',
        data: { result: scenarioResult, editHref: '/dashboard/scenarios' },
      }],
    }
  }

  if (hasUnreviewedDocumentEvidence) {
    return {
      version: GEN_UI_PLAN_VERSION,
      source,
      generatedAt: new Date().toISOString(),
      summary:
        'This workspace is limited to unreviewed document evidence until the extracted values are confirmed.',
      workspaceMode: 'document_review',
      ...(unreviewedDocumentIds.length > 0
        ? {
            documentReviewSnapshot: {
              documentIds: [...new Set(unreviewedDocumentIds)],
              statusAtGeneration: 'pending' as const,
            },
          }
        : {}),
      widgets: [
        buildDataConnectionsWidget(
          {
            type: 'data_connections',
            title: 'Review document values',
            reason:
              'The answer used unreviewed document evidence, so calculations remain unavailable until confirmation.',
          },
          0
        ),
      ],
    }
  }
  const historicalMetricKey = historicalMetricKeyForMessage(userMessage)
  const forecastMetricKey = forecastMetricKeyForMessage(userMessage)
  const forecastHorizon = forecastHorizonForMessage(userMessage)

  const [snapshot, runwayTrend, metricHistoryCollection, metricForecastCollection] = await Promise.all([
    readSourceAwareMetrics(userId),
    readRunwayObservationHistory(userId).catch(() => ({
      observations: [],
      direction: 'insufficient_data' as const,
      change: null,
      averageChange: null,
      workingCapitalAdjusted: {
        observations: [],
        direction: 'insufficient_data' as const,
        change: null,
        averageChange: null,
      },
    })),
    historicalMetricKey
      ? readFinancialMetricHistorySeries({ userId, metricKey: historicalMetricKey, range: 'all', recordLimit: 'all' }).catch(() => null)
      : Promise.resolve(null),
    forecastMetricKey
      ? readFinancialMetricForecastSeries({ userId, metricKey: forecastMetricKey, range: 'all', horizon: forecastHorizon, recordLimit: 'all' }).catch(() => null)
      : Promise.resolve(null),
  ])
  const fallbackSpecs = defaultWidgetSpecs(userMessage, snapshot, source)
  const selectedText = extractSelectedText(userMessage)
  let modelSpecs: PlannerWidget[] | null = null

  try {
    modelSpecs = await chooseWidgetsWithModel({
      userMessage,
      assistantMessage,
      toolsUsed,
      snapshot,
      runwayTrend,
      source,
    })
  } catch (error) {
    console.error(
      'Gen UI widget planning failed; using deterministic fallback selection.',
      error
    )
  }

  // A valid empty model response is intentional; fall back only when planning failed.
  const historySpec = fallbackSpecs.find((spec) => spec.type === 'metric_trend_chart')
  const forecastSpec = fallbackSpecs.find((spec) => spec.type === 'metric_forecast_chart')
  const scenarioSpec: PlannerWidget | null = scenarioResult
    ? {
        type: 'scenario_analysis',
        title: 'Scenario analysis',
        reason: 'This comparison uses the exact deterministic scenario result returned to AI-BOSS.',
      }
    : null
  const specs = dedupeWidgetSpecs([
    ...(historySpec ? [historySpec] : []),
    ...(forecastSpec ? [forecastSpec] : []),
    ...(scenarioSpec ? [scenarioSpec] : []),
    ...(modelSpecs ?? fallbackSpecs).filter(
      (spec) => spec.type !== 'scenario_comparison' && spec.type !== 'scenario_analysis'
    ),
  ])

  if (specs.length === 0) {
    return null
  }

  const context: GenUiDataContext = {
    snapshot,
    runwayTrend,
    source,
    selectedText,
    userMessage,
    metricHistories: metricHistoryCollection?.series ?? [],
    metricForecasts: metricForecastCollection?.series ?? [],
    scenarioResult,
  }
  const widgets = specs.flatMap((spec, index) => {
    if (spec.type === 'metric_trend_chart') {
      return context.metricHistories
        .map((history, seriesIndex) =>
          buildMetricTrendWidget(spec, index * 10 + seriesIndex, context, history)
        )
        .filter((widget): widget is GenUiWidget => widget !== null)
    }

    if (spec.type === 'metric_forecast_chart') {
      return context.metricForecasts
        .map((forecast, seriesIndex) =>
          buildMetricForecastWidget(spec, index * 10 + seriesIndex, context, forecast)
        )
        .filter((widget): widget is GenUiWidget => widget !== null)
    }

    const widget = hydrateWidget(spec, index, context)
    return widget ? [widget] : []
  })

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
