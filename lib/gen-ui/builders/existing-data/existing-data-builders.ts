import {
  FINANCIAL_METRIC_LABELS,
  type FinancialMetricKey,
} from '@/lib/financial-data/metric-keys'
import { isAvailableMetric } from '@/lib/financial-data/metrics'
import { formatRunway } from '@/lib/calculations/runway-display'
import type { MetricHistorySummary } from '@/lib/financial-data/metric-history'
import type {
  AiFinancialBriefWidget,
  FinancialKpiData,
  FinancialTrendData,
  GenUiWidget,
  RevenueGrowthWidget,
} from '@/lib/gen-ui/types'
import { formatCurrency, widgetId } from '../shared'
import type { GenUiDataContext, PlannerWidget } from '../types'

type ExistingDataKpiType =
  | 'cash_balance'
  | 'revenue_snapshot'
  | 'expense_summary'
  | 'accounts_receivable'
  | 'accounts_payable'

const KPI_CONFIGURATION: Record<
  ExistingDataKpiType,
  { metricKey: FinancialMetricKey; title: string }
> = {
  cash_balance: { metricKey: 'cash', title: 'Cash balance' },
  revenue_snapshot: { metricKey: 'monthly_revenue', title: 'Revenue snapshot' },
  expense_summary: { metricKey: 'monthly_expenses', title: 'Expense summary' },
  accounts_receivable: { metricKey: 'accounts_receivable', title: 'Accounts receivable' },
  accounts_payable: { metricKey: 'accounts_payable', title: 'Accounts payable' },
}

function buildFinancialKpiWidget(params: {
  type: ExistingDataKpiType
  spec: PlannerWidget
  index: number
  context: GenUiDataContext
}): GenUiWidget {
  const configuration = KPI_CONFIGURATION[params.type]
  const metric = params.context.snapshot.metrics[configuration.metricKey]
  const unavailable = !isAvailableMetric(metric)
  const data: FinancialKpiData = unavailable
    ? {
        metricKey: configuration.metricKey,
        label: FINANCIAL_METRIC_LABELS[configuration.metricKey],
        value: null,
        currency: null,
        reportingDate: null,
        periodStart: null,
        periodEnd: null,
        sourceLabel: metric.sourceLabel ?? 'Unavailable',
        sourceType: metric.sourceType ?? 'none',
        confidence: null,
      }
    : {
        metricKey: configuration.metricKey,
        label: FINANCIAL_METRIC_LABELS[configuration.metricKey],
        value: metric.value,
        currency: metric.currency,
        reportingDate: metric.asOfDate ?? metric.periodEnd ?? metric.periodStart,
        periodStart: metric.periodStart,
        periodEnd: metric.periodEnd,
        sourceLabel: metric.provenance.sourceLabel,
        sourceType: metric.provenance.sourceType,
        confidence: metric.confidence,
      }

  return {
    id: widgetId(params.type, params.index),
    type: params.type,
    title: params.spec.title ?? configuration.title,
    reason: params.spec.reason ?? `This ${configuration.title.toLowerCase()} directly answers the request.`,
    ...(unavailable
      ? {
          state: {
            status: 'unavailable' as const,
            message: metric.detail ?? `${configuration.title} is not available from connected data.`,
          },
        }
      : {}),
    data,
  } as GenUiWidget
}

export function buildCashBalanceWidget(spec: PlannerWidget, index: number, context: GenUiDataContext) {
  return buildFinancialKpiWidget({ type: 'cash_balance', spec, index, context })
}

export function buildRevenueSnapshotWidget(spec: PlannerWidget, index: number, context: GenUiDataContext) {
  return buildFinancialKpiWidget({ type: 'revenue_snapshot', spec, index, context })
}

export function buildExpenseSummaryWidget(spec: PlannerWidget, index: number, context: GenUiDataContext) {
  return buildFinancialKpiWidget({ type: 'expense_summary', spec, index, context })
}

export function buildAccountsReceivableWidget(spec: PlannerWidget, index: number, context: GenUiDataContext) {
  return buildFinancialKpiWidget({ type: 'accounts_receivable', spec, index, context })
}

export function buildAccountsPayableWidget(spec: PlannerWidget, index: number, context: GenUiDataContext) {
  return buildFinancialKpiWidget({ type: 'accounts_payable', spec, index, context })
}

function historiesFor(context: GenUiDataContext, metricKey: 'monthly_revenue' | 'monthly_expenses') {
  return context.metricHistories.filter((history) => history.metricKey === metricKey)
}

function trendData(history: MetricHistorySummary): FinancialTrendData {
  const latest = history.points.at(-1)
  const previous = history.points.at(-2)
  const change = latest && previous
    ? Number((latest.value - previous.value).toFixed(2))
    : null
  const percentageChange = change !== null && previous && previous.value !== 0
    ? Number(((change / Math.abs(previous.value)) * 100).toFixed(2))
    : null

  return {
    metricKey: history.metricKey as 'monthly_revenue' | 'monthly_expenses',
    label: history.label,
    currency: history.currency,
    points: history.points.map((point) => ({
      date: point.date,
      value: point.value,
      sourceLabel: point.sourceLabel,
      confidence: point.confidence,
    })),
    direction: history.direction,
    change,
    percentageChange,
    periodStart: history.points[0]?.date ?? null,
    periodEnd: latest?.date ?? null,
    note: history.hasRecordedDateFallback
      ? 'Some points use their recorded date because no reporting date was supplied.'
      : 'Each point represents the latest trusted observation for a distinct reporting period.',
  }
}

function buildTrendWidgets(params: {
  type: 'revenue_trend' | 'expense_trend'
  metricKey: 'monthly_revenue' | 'monthly_expenses'
  defaultTitle: string
  spec: PlannerWidget
  index: number
  context: GenUiDataContext
}) {
  const histories = historiesFor(params.context, params.metricKey)

  if (histories.length === 0) {
    return [{
      id: widgetId(params.type, params.index),
      type: params.type,
      title: params.spec.title ?? params.defaultTitle,
      reason: params.spec.reason ?? 'This trend directly answers the historical question.',
      state: {
        status: 'unavailable' as const,
        message: `At least two distinct ${FINANCIAL_METRIC_LABELS[params.metricKey].toLowerCase()} reporting periods are required.`,
      },
      data: {
        metricKey: params.metricKey,
        label: FINANCIAL_METRIC_LABELS[params.metricKey],
        currency: null,
        points: [],
        direction: 'insufficient_data' as const,
        change: null,
        percentageChange: null,
        periodStart: null,
        periodEnd: null,
        note: 'Historical data is unavailable.',
      },
    } as GenUiWidget]
  }

  return histories.map((history, historyIndex) => ({
    id: widgetId(params.type, params.index * 10 + historyIndex),
    type: params.type,
    title: params.spec.title
      ?? `${params.defaultTitle}${histories.length > 1 && history.currency ? ` · ${history.currency}` : ''}`,
    reason: params.spec.reason ?? 'This trend uses trusted values from distinct reporting periods.',
    ...(history.points.length < 2
      ? {
          state: {
            status: 'unavailable' as const,
            message: `At least two distinct reporting periods are required for a ${params.defaultTitle.toLowerCase()}.`,
          },
        }
      : {}),
    data: trendData(history),
  } as GenUiWidget))
}

export function buildRevenueTrendWidgets(spec: PlannerWidget, index: number, context: GenUiDataContext) {
  return buildTrendWidgets({
    type: 'revenue_trend',
    metricKey: 'monthly_revenue',
    defaultTitle: 'Revenue trend',
    spec,
    index,
    context,
  })
}

export function buildExpenseTrendWidgets(spec: PlannerWidget, index: number, context: GenUiDataContext) {
  return buildTrendWidgets({
    type: 'expense_trend',
    metricKey: 'monthly_expenses',
    defaultTitle: 'Expense trend',
    spec,
    index,
    context,
  })
}

export function buildRevenueGrowthWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
): RevenueGrowthWidget {
  const currentRevenue = context.snapshot.metrics.monthly_revenue
  const preferredCurrency = isAvailableMetric(currentRevenue)
    ? currentRevenue.currency
    : null
  const histories = historiesFor(context, 'monthly_revenue')
  const history = histories.find((candidate) => candidate.currency === preferredCurrency)
    ?? histories[0]
  const current = history?.points.at(-1)
  const previous = history?.points.at(-2)
  const canCalculate = Boolean(current && previous && previous.value !== 0)
  const growthPercentage = canCalculate
    ? Number((((current!.value - previous!.value) / Math.abs(previous!.value)) * 100).toFixed(2))
    : null

  return {
    id: widgetId('revenue_growth', index),
    type: 'revenue_growth',
    title: spec.title ?? 'Revenue growth',
    reason: spec.reason ?? 'This compares the latest two distinct revenue reporting periods.',
    ...(!canCalculate
      ? {
          state: {
            status: 'unavailable' as const,
            message: previous?.value === 0
              ? 'Revenue growth cannot be calculated from a zero-value prior period.'
              : 'Two distinct revenue reporting periods are required to calculate growth.',
          },
        }
      : {}),
    data: {
      currentValue: current?.value ?? null,
      previousValue: previous?.value ?? null,
      growthPercentage,
      currency: history?.currency ?? null,
      currentPeriod: current?.date ?? null,
      previousPeriod: previous?.date ?? null,
      direction: growthPercentage === null
        ? 'unavailable'
        : growthPercentage > 0
          ? 'up'
          : growthPercentage < 0
            ? 'down'
            : 'stable',
      sourceLabels: [...new Set([previous?.sourceLabel, current?.sourceLabel].filter((label): label is string => Boolean(label)))],
    },
  }
}

function reportingDate(metric: { asOfDate: string | null; periodEnd: string | null; periodStart: string | null }) {
  return metric.asOfDate ?? metric.periodEnd ?? metric.periodStart ?? 'date unavailable'
}

export function buildAiFinancialBriefWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
): AiFinancialBriefWidget {
  const facts: AiFinancialBriefWidget['data']['facts'] = []
  const addMetricFact = (
    key: FinancialMetricKey,
    label: string,
    detail: (value: number) => string,
    tone: 'positive' | 'warning' | 'neutral' = 'neutral',
  ) => {
    const metric = context.snapshot.metrics[key]
    if (!isAvailableMetric(metric)) return
    facts.push({
      label,
      value: key === 'runway_months'
        ? formatRunway(metric.value)
        : formatCurrency(metric.value, metric.currency),
      detail: `${detail(metric.value)} Reporting date: ${reportingDate(metric)}.`,
      tone,
      sourceLabel: metric.provenance.sourceLabel,
    })
  }

  const runway = context.snapshot.metrics.runway_months
  addMetricFact(
    'runway_months',
    'Cash runway',
    () => 'Calculated from compatible cash and burn inputs.',
    isAvailableMetric(runway) && runway.value < 6 ? 'warning' : 'positive',
  )
  addMetricFact('cash', 'Cash balance', () => 'Latest trusted available cash.', 'neutral')
  addMetricFact('monthly_revenue', 'Monthly revenue', () => 'Latest trusted revenue total.', 'positive')
  addMetricFact('monthly_expenses', 'Monthly expenses', () => 'Latest trusted expense total.', 'neutral')
  addMetricFact('accounts_receivable', 'Accounts receivable', () => 'Aggregate customer balances available to collect.', 'neutral')

  const availableCount = facts.length
  const summary = availableCount === 0
    ? 'No verified structured financial facts are available for a financial brief.'
    : `This brief is based on ${availableCount} verified structured financial fact${availableCount === 1 ? '' : 's'}; it does not add model-invented values.`

  return {
    id: widgetId('ai_financial_brief', index),
    type: 'ai_financial_brief',
    title: spec.title ?? 'AI financial brief',
    reason: spec.reason ?? 'This concise brief summarizes the verified facts most relevant to financial health.',
    ...(availableCount === 0
      ? { state: { status: 'unavailable' as const, message: summary } }
      : availableCount < 3
        ? { state: { status: 'partial' as const, message: 'Only a limited set of verified metrics is currently available.' } }
        : {}),
    data: { summary, facts: facts.slice(0, 5) },
  }
}
