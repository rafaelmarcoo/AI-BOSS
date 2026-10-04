import { FINANCIAL_METRIC_LABELS } from "@/lib/financial-data/metric-keys";
import { getMetricNumber, isAvailableMetric } from "@/lib/financial-data/metrics";
import type { GenUiWidget } from "@/lib/gen-ui/types";
import {
  formatCurrency,
  formatNumber,
  listMissingMetrics,
  widgetId,
} from "../shared";
import type { GenUiDataContext, PlannerWidget } from "../types";
import { DEFAULT_DASHBOARD_RISK_THRESHOLDS } from "@/lib/gen-ui/dashboard-layout-types";

export function buildPlanningChecklistWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget {
  const { runwayUrgentMonths: urgentThreshold } =
    context.riskThresholds ?? DEFAULT_DASHBOARD_RISK_THRESHOLDS
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
        currentRunway !== null && currentRunway < urgentThreshold
          ? 'Treat runway as urgent'
          : 'Review runway buffer',
      detail:
        currentRunway !== null
          ? `Current runway is ${formatNumber(currentRunway)} months.`
          : 'Cash runway is unavailable, so collect compatible cash and burn first.',
      tone:
        currentRunway !== null && currentRunway < urgentThreshold
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

export function buildRiskThresholdTimelineWidget(
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext
): GenUiWidget {
  const {
    runwayCautionMonths: cautionThreshold,
    runwayUrgentMonths: urgentThreshold,
  } = context.riskThresholds ?? DEFAULT_DASHBOARD_RISK_THRESHOLDS
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
  const monthsUntilCaution = monthsUntil(cautionThreshold)
  const monthsUntilUrgent = monthsUntil(urgentThreshold)
  const status =
    currentRunway === null
      ? 'unknown'
      : currentRunway < urgentThreshold
        ? 'urgent'
        : currentRunway < cautionThreshold
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
export function buildMissingDataPanelWidget(
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

export function buildHighlightExplainerWidget(
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
