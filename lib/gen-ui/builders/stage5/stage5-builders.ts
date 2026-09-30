import {
  summarizeBalanceSheetCategories,
  summarizeBalanceSheetMetrics,
  summarizeDebtOverview,
  summarizeDebtRepayments,
} from '@/lib/financial-data/reporting/balance-sheet-calculations'
import type { GenUiWidget, GenUiWidgetType } from '@/lib/gen-ui/types'
import { widgetId } from '../shared'
import type { GenUiDataContext, PlannerWidget } from '../types'

function title(spec: PlannerWidget, fallback: string) {
  return spec.title ?? fallback
}

function reason(spec: PlannerWidget, fallback: string) {
  return spec.reason ?? fallback
}

function unavailable<T extends GenUiWidget>(widget: T, message: string): T {
  return { ...widget, state: { status: 'unavailable', message } }
}

function currentDate() {
  return new Date().toISOString().slice(0, 10)
}

function addMonths(date: string, months: number) {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCMonth(value.getUTCMonth() + months)
  return value.toISOString().slice(0, 10)
}

function horizonMonths(message: string): 3 | 6 | 12 {
  if (/\b(?:12\s*months?|1\s*year)\b/i.test(message)) return 12
  if (/\b6\s*months?\b/i.test(message)) return 6
  return 3
}

function balanceMetricWidget(
  type: 'working_capital' | 'current_ratio' | 'quick_ratio',
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
): GenUiWidget {
  const groups = summarizeBalanceSheetMetrics(context.stage3Data)
  const config = {
    working_capital: {
      label: 'Working capital',
      reason: 'This subtracts classified current liabilities from classified current assets.',
      formula: 'Current assets − current liabilities',
      note: 'Each source and currency is shown separately; no currency conversion is applied.',
    },
    current_ratio: {
      label: 'Current ratio',
      reason: 'This divides classified current assets by classified current liabilities.',
      formula: 'Current assets ÷ current liabilities',
      note: 'A ratio is unavailable when current liabilities are zero or missing.',
    },
    quick_ratio: {
      label: 'Quick ratio',
      reason: 'This uses only current assets explicitly classified for quick-ratio treatment.',
      formula: 'Quick assets ÷ current liabilities',
      note: 'The ratio remains unavailable while any current asset has unclassified treatment.',
    },
  }[type]
  const widget = {
    id: widgetId(type, index),
    type,
    title: title(spec, config.label),
    reason: reason(spec, config.reason),
    data: { groups, formula: config.formula, note: config.note },
  } as GenUiWidget
  return context.stage3Data.capabilities.includes('balance_sheet')
    ? widget
    : unavailable(widget, 'A classified balance sheet is required for this calculation.')
}

export const buildWorkingCapitalWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) =>
  balanceMetricWidget('working_capital', spec, index, context)
export const buildCurrentRatioWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) =>
  balanceMetricWidget('current_ratio', spec, index, context)
export const buildQuickRatioWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) =>
  balanceMetricWidget('quick_ratio', spec, index, context)

function balanceCategoryWidget(
  type: 'asset_summary' | 'liability_summary' | 'equity_snapshot',
  kind: 'assets' | 'liabilities' | 'equity',
  spec: PlannerWidget,
  index: number,
  context: GenUiDataContext,
): GenUiWidget {
  const groups = summarizeBalanceSheetCategories(context.stage3Data, kind)
  const labels = {
    asset_summary: 'Asset summary',
    liability_summary: 'Liability summary',
    equity_snapshot: 'Equity snapshot',
  }
  const widget = {
    id: widgetId(type, index),
    type,
    title: title(spec, labels[type]),
    reason: reason(spec, `This groups classified ${kind} from the latest balance sheet.`),
    data: {
      groups,
      note: 'Component lines are grouped without adding statement total rows again.',
    },
  } as GenUiWidget
  return context.stage3Data.capabilities.includes('balance_sheet')
    ? widget
    : unavailable(widget, 'A classified balance sheet is required for this summary.')
}

export const buildAssetSummaryWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) =>
  balanceCategoryWidget('asset_summary', 'assets', spec, index, context)
export const buildLiabilitySummaryWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) =>
  balanceCategoryWidget('liability_summary', 'liabilities', spec, index, context)
export const buildEquitySnapshotWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) =>
  balanceCategoryWidget('equity_snapshot', 'equity', spec, index, context)

export function buildDebtOverviewWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const widget: GenUiWidget = {
    id: widgetId('debt_overview', index),
    type: 'debt_overview',
    title: title(spec, 'Debt overview'),
    reason: reason(spec, 'This summarizes active recorded debts by source and currency.'),
    data: {
      groups: summarizeDebtOverview(context.stage3Data),
      note: 'Balances are stored debt records; no foreign-exchange conversion is applied.',
    },
  }
  return context.stage3Data.capabilities.includes('debt_details')
    ? widget
    : unavailable(widget, 'Detailed debt records are required for this overview.')
}

export function buildDebtRepaymentTimelineWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const asOfDate = currentDate()
  const horizon = horizonMonths(context.userMessage)
  const throughDate = addMonths(asOfDate, horizon)
  const widget: GenUiWidget = {
    id: widgetId('debt_repayment_timeline', index),
    type: 'debt_repayment_timeline',
    title: title(spec, `Debt repayments — next ${horizon} months`),
    reason: reason(spec, 'This timeline uses only stored scheduled repayment dates and amounts.'),
    data: {
      asOfDate,
      throughDate,
      horizonMonths: horizon,
      groups: summarizeDebtRepayments({ data: context.stage3Data, asOfDate, throughDate }),
      note: 'No repayment dates are inferred from a loan balance or maturity date.',
    },
  }
  return context.stage3Data.capabilities.includes('debt_repayment_schedule')
    ? widget
    : unavailable(widget, 'Stored debt repayment schedules are required for this timeline.')
}

export const STAGE5_WIDGET_TYPES: GenUiWidgetType[] = [
  'working_capital',
  'current_ratio',
  'quick_ratio',
  'asset_summary',
  'liability_summary',
  'equity_snapshot',
  'debt_overview',
  'debt_repayment_timeline',
]
