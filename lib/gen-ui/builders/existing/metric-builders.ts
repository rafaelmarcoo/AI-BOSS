import {
  FINANCIAL_METRIC_LABELS,
  type FinancialMetricKey,
} from "@/lib/financial-data/metric-keys";
import { isAvailableMetric } from "@/lib/financial-data/metrics";
import { formatRunway } from "@/lib/calculations/runway-display";
import type { MetricForecastSummary } from "@/lib/financial-data/metric-forecast";
import type { MetricHistorySummary } from "@/lib/financial-data/metric-history";
import type { GenUiWidget, MetricSnapshotWidget } from "@/lib/gen-ui/types";
import {
  formatCurrency,
  metricDisplayContext,
  widgetId,
} from "../shared";
import type { GenUiDataContext, PlannerWidget } from "../types";

export function buildMetricSnapshotWidget(
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
        unit: null,
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
          ? formatRunway(metric.value)
          : formatCurrency(metric.value, metric.currency),
      unit: null,
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
            value: formatRunway(adjusted.value),
            unit: null,
            sourceLabel: adjusted.provenance.sourceLabel,
            sourceTone: 'derived',
            ...adjustedContext,
          }
        : {
            key: 'runway_months',
            runwayVariant: 'working_capital_adjusted',
            label: 'Working-capital-adjusted runway',
            value: '-',
            unit: null,
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

export function buildDataConnectionsWidget(
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

export function buildMetricTrendWidget(
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

export function buildMetricForecastWidget(
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
export function buildMetricSourceEvidenceWidget(
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
          ? formatRunway(metric.value)
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
          value: formatRunway(adjustedRunway.value),
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
