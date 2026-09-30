import {
  calculateBreakEven,
  detectExpenseChanges,
  expenseBreakdown,
  forecastCashBalance,
  forecastDatedValues,
  rankLargestExpenses,
  summarizeBudgetPerformance,
  summarizeCashFlowPeriods,
  summarizeProfitPeriods,
} from '@/lib/financial-data/reporting/calculations'
import type {
  BudgetWidgetData,
  FinancialForecastData,
  GenUiWidget,
  GenUiWidgetType,
} from '@/lib/gen-ui/types'
import { widgetId } from '../shared'
import type { GenUiDataContext, PlannerWidget } from '../types'

function unavailable<T extends GenUiWidget>(widget: T, message: string): T {
  return { ...widget, state: { status: 'unavailable', message } }
}

function title(spec: PlannerWidget, fallback: string) {
  return spec.title ?? fallback
}

function reason(spec: PlannerWidget, fallback: string) {
  return spec.reason ?? fallback
}

function profitType(message: string): 'gross' | 'operating' | 'net' {
  if (/\bgross\b/i.test(message)) return 'gross'
  if (/\bnet\b/i.test(message)) return 'net'
  return 'operating'
}

function profitValue(
  period: ReturnType<typeof summarizeProfitPeriods>[number],
  type: 'gross' | 'operating' | 'net',
) {
  return type === 'gross' ? period.grossProfit : type === 'net' ? period.netProfit : period.operatingProfit
}

function forecastHorizon(message: string) {
  if (/\b12\s*(?:months?|m)\b/i.test(message)) return 12
  if (/\b6\s*(?:months?|m)\b/i.test(message)) return 6
  return 3
}

function cashHorizonDays(message: string): 30 | 60 | 90 {
  if (/\b90\s*days?\b/i.test(message)) return 90
  if (/\b60\s*days?\b/i.test(message)) return 60
  return 30
}

function emptyForecast(label: string): FinancialForecastData {
  return { label, currency: null, actualPoints: [], forecastPoints: [], method: 'Unavailable', assumptions: [] }
}

function latestAlignedSeries<T extends { currency: string; sourceLabel: string; periodEnd: string }>(values: T[]) {
  const latest = values.at(-1)
  if (!latest) return []
  return values.filter((value) =>
    value.currency === latest.currency && value.sourceLabel === latest.sourceLabel
  )
}

export function buildCashFlowSummaryWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const latest = summarizeCashFlowPeriods(context.stage3Data).at(-1)
  const widget: GenUiWidget = {
    id: widgetId('cash_flow_summary', index), type: 'cash_flow_summary',
    title: title(spec, 'Cash flow summary'),
    reason: reason(spec, 'This uses recorded cash movements rather than revenue minus expenses.'),
    data: {
      currency: latest?.currency ?? null,
      periodStart: latest?.periodStart ?? null,
      periodEnd: latest?.periodEnd ?? null,
      sourceLabel: latest?.sourceLabel ?? 'Unavailable',
      metrics: [
        { label: 'Cash inflow', value: latest?.inflow ?? null, tone: 'positive' },
        { label: 'Cash outflow', value: latest?.outflow ?? null, tone: 'warning' },
        { label: 'Net cash flow', value: latest?.netCashFlow ?? null, tone: (latest?.netCashFlow ?? 0) >= 0 ? 'positive' : 'warning' },
      ],
      note: 'Cash flow uses recorded cash movements and is not approximated from revenue and expenses.',
    },
  }
  return latest ? widget : unavailable(widget, 'A recorded cash-flow statement is required.')
}

export function buildCashFlowForecastWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const days = cashHorizonDays(context.userMessage)
  const cashFlows = latestAlignedSeries(summarizeCashFlowPeriods(context.stage3Data))
  const result = forecastCashBalance({ snapshot: context.snapshot, cashFlows, horizon: Math.ceil(days / 30) })
  const cashMetric = context.snapshot.metrics.cash
  const cashDate = cashMetric.status === 'available'
    ? cashMetric.asOfDate ?? cashMetric.periodEnd
    : null
  const actualPoints = cashMetric.status === 'available' && cashDate
    ? [{ date: cashDate, value: cashMetric.value }]
    : []
  const widget: GenUiWidget = {
    id: widgetId('cash_flow_forecast', index), type: 'cash_flow_forecast',
    title: title(spec, `${days}-day cash flow forecast`),
    reason: reason(spec, 'This projects the cash balance from recorded cash-flow history.'),
    data: {
      label: 'Projected cash balance', currency: result.currency, openingCash: result.openingCash,
      horizonDays: days, actualPoints, forecastPoints: result.points.map(({ date, value }) => ({ date, value })),
      method: result.method, assumptions: result.assumptions,
    },
  }
  return result.points.length > 0 ? widget : unavailable(widget, 'Latest cash plus at least two recorded cash-flow periods are required.')
}

export function buildRevenueForecastWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const revenueMetric = context.snapshot.metrics.monthly_revenue
  const preferredCurrency = revenueMetric.status === 'available' ? revenueMetric.currency : null
  const revenueForecasts = context.metricForecasts.filter((item) => item.metricKey === 'monthly_revenue')
  const forecast = revenueForecasts.find((item) => item.history.currency === preferredCurrency) ?? revenueForecasts[0]
  const widget: GenUiWidget = {
    id: widgetId('revenue_forecast', index), type: 'revenue_forecast',
    title: title(spec, 'Revenue forecast'), reason: reason(spec, 'This continues the recorded date-aware revenue trend.'),
    data: forecast ? {
      label: forecast.label, currency: forecast.history.currency,
      actualPoints: forecast.history.points.map(({ date, value }) => ({ date, value })),
      forecastPoints: forecast.forecastPoints.map(({ date, value }) => ({ date, value })),
      method: forecast.method.replaceAll('_', ' '), assumptions: forecast.assumptions,
    } : emptyForecast('Revenue'),
  }
  return forecast?.forecastPoints.length ? widget : unavailable(widget, 'At least two distinct revenue periods are required for a forecast.')
}

export function buildProfitSnapshotWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const latest = summarizeProfitPeriods(context.stage3Data).at(-1)
  const widget: GenUiWidget = {
    id: widgetId('profit_snapshot', index), type: 'profit_snapshot', title: title(spec, 'Profit snapshot'),
    reason: reason(spec, 'This separates gross, operating, and net profit where each is available.'),
    data: {
      currency: latest?.currency ?? null, periodStart: latest?.periodStart ?? null, periodEnd: latest?.periodEnd ?? null,
      sourceLabel: latest?.sourceLabel ?? 'Unavailable',
      metrics: [
        { label: 'Gross profit', value: latest?.grossProfit ?? null, tone: (latest?.grossProfit ?? 0) >= 0 ? 'positive' : 'warning' },
        { label: 'Operating profit', value: latest?.operatingProfit ?? null, tone: (latest?.operatingProfit ?? 0) >= 0 ? 'positive' : 'warning' },
        { label: 'Net profit', value: latest?.netProfit ?? null, tone: (latest?.netProfit ?? 0) >= 0 ? 'positive' : 'warning' },
      ],
      note: 'Unavailable profit types are not inferred from incomplete statement classifications.',
    },
  }
  return latest ? widget : unavailable(widget, 'A normalized profit-and-loss reporting period is required.')
}

export function buildProfitTrendWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const type = profitType(context.userMessage)
  const periods = latestAlignedSeries(summarizeProfitPeriods(context.stage3Data))
  const actual = periods.flatMap((period) => {
    const value = profitValue(period, type)
    return value === null ? [] : [{ date: period.periodEnd, value, kind: 'actual' as const }]
  })
  const forecast = forecastDatedValues(actual, 3)
  const widget: GenUiWidget = {
    id: widgetId('profit_trend', index), type: 'profit_trend', title: title(spec, `${type[0].toUpperCase()}${type.slice(1)} profit trend`),
    reason: reason(spec, `This shows recorded ${type} profit and a clearly marked near-term projection.`),
    data: {
      label: `${type} profit`, profitType: type, currency: periods.at(-1)?.currency ?? null,
      actualPoints: actual.map(({ date, value }) => ({ date, value })),
      forecastPoints: forecast.points.map(({ date, value }) => ({ date, value })),
      method: forecast.method, assumptions: forecast.assumptions,
    },
  }
  return forecast.points.length > 0 ? widget : unavailable(widget, `At least two periods containing ${type} profit are required.`)
}

export function buildProfitForecastWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const type = profitType(context.userMessage)
  const periods = latestAlignedSeries(summarizeProfitPeriods(context.stage3Data))
  const actual = periods.flatMap((period) => {
    const value = profitValue(period, type)
    return value === null ? [] : [{ date: period.periodEnd, value, kind: 'actual' as const }]
  })
  const forecast = forecastDatedValues(actual, forecastHorizon(context.userMessage))
  const widget: GenUiWidget = {
    id: widgetId('profit_forecast', index), type: 'profit_forecast', title: title(spec, `${type[0].toUpperCase()}${type.slice(1)} profit forecast`),
    reason: reason(spec, `This projects ${type} profit from recorded reporting periods.`),
    data: { label: `${type} profit`, profitType: type, currency: periods.at(-1)?.currency ?? null, actualPoints: actual.map(({ date, value }) => ({ date, value })), forecastPoints: forecast.points.map(({ date, value }) => ({ date, value })), method: forecast.method, assumptions: forecast.assumptions },
  }
  return forecast.points.length ? widget : unavailable(widget, `At least two periods containing ${type} profit are required for a forecast.`)
}

export function buildProfitMarginWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const type = profitType(context.userMessage)
  const periods = latestAlignedSeries(summarizeProfitPeriods(context.stage3Data))
  const latest = periods.at(-1)
  const previous = periods.at(-2)
  const profit = latest ? profitValue(latest, type) : null
  const margin = latest?.revenue && profit !== null ? (profit / Math.abs(latest.revenue)) * 100 : null
  const previousProfit = previous ? profitValue(previous, type) : null
  const previousMargin = previous?.revenue && previousProfit !== null
    ? (previousProfit / Math.abs(previous.revenue)) * 100
    : null
  const comparisonPercentage = margin !== null && previousMargin !== null
    ? Number((margin - previousMargin).toFixed(1))
    : null
  const widget: GenUiWidget = {
    id: widgetId('profit_margin', index), type: 'profit_margin', title: title(spec, `${type[0].toUpperCase()}${type.slice(1)} profit margin`),
    reason: reason(spec, `This identifies the ${type} margin rather than combining profit definitions.`),
    data: {
      marginType: type, currency: latest?.currency ?? null, periodStart: latest?.periodStart ?? null, periodEnd: latest?.periodEnd ?? null,
      sourceLabel: latest?.sourceLabel ?? 'Unavailable', metrics: [{
        label: `${type} margin`, value: profit, percentage: margin,
        comparisonPercentage, comparisonLabel: previous ? `vs period ending ${previous.periodEnd}` : null,
        tone: (margin ?? 0) >= 0 ? 'positive' : 'warning',
      }],
      note: `${type[0].toUpperCase()}${type.slice(1)} profit divided by revenue for the same reporting period.`,
    },
  }
  return margin !== null ? widget : unavailable(widget, `${type} profit and revenue are required for this margin.`)
}

export function buildBreakEvenAnalysisWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const analysis = calculateBreakEven(context.stage3Data)
  const result = analysis.result
  const widget: GenUiWidget = {
    id: widgetId('break_even_analysis', index), type: 'break_even_analysis', title: title(spec, 'Break-even analysis'),
    reason: reason(spec, 'This uses only explicitly classified fixed and variable costs.'),
    data: {
      currency: result?.currency ?? null, revenue: result?.revenue ?? null, fixedCosts: result?.fixedCosts ?? null,
      variableCosts: result?.variableCosts ?? null, contributionMarginPercentage: result ? result.contributionMarginRatio * 100 : null,
      breakEvenRevenue: result?.breakEvenRevenue ?? null, unclassifiedCostAmount: analysis.unclassifiedCostAmount,
      note: analysis.reason ?? 'Break-even revenue equals fixed costs divided by contribution margin ratio.',
    },
  }
  return result ? widget : unavailable(widget, analysis.reason ?? 'Break-even data is unavailable.')
}

export function buildBreakEvenProgressWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const analysis = calculateBreakEven(context.stage3Data)
  const result = analysis.result
  const widget: GenUiWidget = {
    id: widgetId('break_even_progress', index), type: 'break_even_progress', title: title(spec, 'Break-even progress'),
    reason: reason(spec, 'This compares current revenue with the classified break-even requirement.'),
    data: {
      currency: result?.currency ?? null, currentRevenue: result?.revenue ?? null, breakEvenRevenue: result?.breakEvenRevenue ?? null,
      progressPercentage: result?.progressPercentage ?? null,
      remainingRevenue: result ? Math.max(0, result.breakEvenRevenue - result.revenue) : null,
      note: analysis.reason ?? 'Progress may exceed 100% when current revenue is above break-even.',
    },
  }
  return result ? widget : unavailable(widget, analysis.reason ?? 'Break-even progress is unavailable.')
}

export function buildExpenseBreakdownWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const categories = expenseBreakdown(context.stage3Data)
  const latest = context.stage3Data.reportingPeriods.filter((period) => period.statement_type === 'profit_loss').at(-1)
  const widget: GenUiWidget = {
    id: widgetId('expense_breakdown', index), type: 'expense_breakdown', title: title(spec, 'Expense breakdown'),
    reason: reason(spec, 'This groups normalized statement lines by expense category.'),
    data: { currency: latest?.currency ?? null, periodStart: latest?.period_start ?? null, periodEnd: latest?.period_end ?? null, categories: categories.map((item) => ({ label: item.category, amount: item.amount, percentage: item.percentage })) },
  }
  return categories.length ? widget : unavailable(widget, 'Categorized expense statement lines are required.')
}

export function buildLargestExpensesWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const items = rankLargestExpenses(context.stage3Data)
  const latestOutflow = [...context.stage3Data.transactions]
    .filter((item) => item.direction === 'outflow')
    .sort((left, right) => left.transaction_date.localeCompare(right.transaction_date))
    .at(-1)
  const widget: GenUiWidget = {
    id: widgetId('largest_expenses', index), type: 'largest_expenses', title: title(spec, 'Largest expenses'),
    reason: reason(spec, 'This ranks posted cash outflow transactions without inventing supplier detail.'),
    data: { currency: latestOutflow?.currency ?? null, items },
  }
  return items.length ? widget : unavailable(widget, 'Posted expense transactions are required.')
}

export function buildExpenseChangeDetectorWidget(spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const changes = detectExpenseChanges(context.stage3Data)
  const widget: GenUiWidget = {
    id: widgetId('expense_change_detector', index), type: 'expense_change_detector', title: title(spec, 'Expense change detector'),
    reason: reason(spec, 'This compares aligned categories across the latest two reporting periods.'),
    data: { currency: context.stage3Data.reportingPeriods.filter((period) => period.statement_type === 'profit_loss').at(-1)?.currency ?? null, changes },
  }
  return changes.length ? widget : unavailable(widget, 'Two categorized expense reporting periods are required.')
}

function budgetData(context: GenUiDataContext): BudgetWidgetData {
  const summary = summarizeBudgetPerformance(context.stage3Data)
  return summary ? {
    budgetName: summary.budgetName, currency: summary.currency, periodStart: summary.periodStart, periodEnd: summary.periodEnd,
    totalBudget: summary.totalBudget, totalActual: summary.totalActual, totalRemaining: summary.totalRemaining,
    projectedActual: summary.projectedActual, projectedVariance: summary.projectedVariance, elapsedPercentage: summary.elapsedPercentage,
    lines: summary.lines.map(({ label, budgetAmount, actualAmount, variance, remaining }) => ({ label, budgetAmount, actualAmount, variance, remaining })),
  } : { budgetName: null, currency: null, periodStart: null, periodEnd: null, totalBudget: null, totalActual: null, totalRemaining: null, projectedActual: null, projectedVariance: null, elapsedPercentage: null, lines: [] }
}

function buildBudgetWidget(type: 'budget_vs_actual' | 'budget_remaining' | 'budget_forecast', spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const data = budgetData(context)
  const labels = { budget_vs_actual: 'Budget vs actual', budget_remaining: 'Budget remaining', budget_forecast: 'Budget forecast' } as const
  const base = { id: widgetId(type, index), type, title: title(spec, labels[type]), reason: reason(spec, 'This aligns budget lines with actual records for the same period and currency.') }
  const widget = type === 'budget_forecast'
    ? { ...base, type, data: { ...data, method: 'Elapsed-period run rate', assumptions: ['Actual activity continues at the current average rate through the budget end date.', 'No currency conversion is performed.'] } }
    : { ...base, type, data }
  return data.budgetName ? widget as GenUiWidget : unavailable(widget as GenUiWidget, 'An approved or draft budget with dated lines is required.')
}

export const buildBudgetVsActualWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) => buildBudgetWidget('budget_vs_actual', spec, index, context)
export const buildBudgetRemainingWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) => buildBudgetWidget('budget_remaining', spec, index, context)
export const buildBudgetForecastWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) => buildBudgetWidget('budget_forecast', spec, index, context)

function buildDirectionalCashForecast(type: 'cash_inflow_forecast' | 'cash_outflow_forecast', spec: PlannerWidget, index: number, context: GenUiDataContext): GenUiWidget {
  const flows = latestAlignedSeries(summarizeCashFlowPeriods(context.stage3Data))
  const key = type === 'cash_inflow_forecast' ? 'inflow' : 'outflow'
  const label = key === 'inflow' ? 'Cash inflow' : 'Cash outflow'
  const actual = flows.flatMap((period) => period[key] === null ? [] : [{ date: period.periodEnd, value: period[key]!, kind: 'actual' as const }])
  const forecast = forecastDatedValues(actual, forecastHorizon(context.userMessage))
  const widget: GenUiWidget = {
    id: widgetId(type, index), type, title: title(spec, `${label} forecast`),
    reason: reason(spec, `This projects recorded ${label.toLowerCase()} without using unpaid invoices or bills.`),
    data: { label, currency: flows.at(-1)?.currency ?? null, actualPoints: actual.map(({ date, value }) => ({ date, value })), forecastPoints: forecast.points.map(({ date, value }) => ({ date, value })), method: forecast.method, assumptions: forecast.assumptions },
  } as GenUiWidget
  return forecast.points.length ? widget : unavailable(widget, `At least two recorded ${label.toLowerCase()} periods are required.`)
}

export const buildCashInflowForecastWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) => buildDirectionalCashForecast('cash_inflow_forecast', spec, index, context)
export const buildCashOutflowForecastWidget = (spec: PlannerWidget, index: number, context: GenUiDataContext) => buildDirectionalCashForecast('cash_outflow_forecast', spec, index, context)

export const STAGE3_WIDGET_TYPES: GenUiWidgetType[] = [
  'cash_flow_summary', 'cash_flow_forecast', 'revenue_forecast', 'profit_snapshot', 'profit_trend', 'profit_forecast',
  'profit_margin', 'break_even_analysis', 'break_even_progress', 'expense_breakdown', 'largest_expenses',
  'expense_change_detector', 'budget_vs_actual', 'budget_remaining', 'budget_forecast', 'cash_inflow_forecast', 'cash_outflow_forecast',
]
