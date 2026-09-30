import type { SourceAwareMetricReadResult } from '@/lib/financial-data/read-model'
import { getMetricNumber } from '@/lib/financial-data/metrics'
import type {
  BreakEvenSummary,
  BudgetPerformanceSummary,
  CashFlowPeriodSummary,
  CategoryAmount,
  DatedFinancialValue,
  ExpenseChange,
  ProfitPeriodSummary,
  RankedExpense,
  ReportingPeriodWithLines,
  Stage3FinancialData,
} from './types'

function round(value: number, precision = 2) {
  return Number(value.toFixed(precision))
}

function addMonths(date: string, months: number) {
  const source = new Date(`${date}T00:00:00.000Z`)
  const result = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1))
  return new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)
}

function amountFor(
  period: ReportingPeriodWithLines,
  classification: ReportingPeriodWithLines['lines'][number]['classification'],
) {
  const matching = period.lines.filter((line) => line.classification === classification)
  const total = matching.find((line) => line.is_total)
  if (total) return Number(total.amount)
  if (matching.length === 0) return null
  return round(matching.reduce((sum, line) => sum + Number(line.amount), 0))
}

export function summarizeProfitPeriods(data: Stage3FinancialData): ProfitPeriodSummary[] {
  return data.reportingPeriods
    .filter((period) => period.statement_type === 'profit_loss')
    .map((period) => {
      const revenue = amountFor(period, 'revenue')
      const costOfSales = amountFor(period, 'cost_of_sales')
      const operatingExpenses = amountFor(period, 'operating_expense')
      const explicitGross = amountFor(period, 'gross_profit')
      const explicitOperating = amountFor(period, 'operating_profit')
      const explicitNet = amountFor(period, 'net_profit')
      const otherIncome = amountFor(period, 'other_income')
      const otherExpense = amountFor(period, 'other_expense')
      const grossProfit = explicitGross ?? (
        revenue !== null && costOfSales !== null ? round(revenue - costOfSales) : null
      )
      const operatingProfit = explicitOperating ?? (
        grossProfit !== null && operatingExpenses !== null
          ? round(grossProfit - operatingExpenses)
          : revenue !== null && costOfSales === null && operatingExpenses !== null
            ? round(revenue - operatingExpenses)
            : null
      )
      const netProfit = explicitNet ?? (
        operatingProfit !== null && (otherIncome !== null || otherExpense !== null)
          ? round(operatingProfit + (otherIncome ?? 0) - (otherExpense ?? 0))
          : null
      )

      return {
        periodStart: period.period_start,
        periodEnd: period.period_end,
        currency: period.currency,
        revenue,
        costOfSales,
        operatingExpenses,
        grossProfit,
        operatingProfit,
        netProfit,
        sourceLabel: period.source_label,
      }
    })
    .sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
}

export function summarizeCashFlowPeriods(data: Stage3FinancialData): CashFlowPeriodSummary[] {
  return data.reportingPeriods
    .filter((period) => period.statement_type === 'cash_flow')
    .map((period) => {
      const inflow = amountFor(period, 'cash_inflow')
      const outflow = amountFor(period, 'cash_outflow')
      const netCashFlow = amountFor(period, 'net_cash_flow')
        ?? (inflow !== null && outflow !== null ? round(inflow - outflow) : null)
      return {
        periodStart: period.period_start,
        periodEnd: period.period_end,
        currency: period.currency,
        inflow,
        outflow,
        netCashFlow,
        sourceLabel: period.source_label,
      }
    })
    .sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
}

export function forecastDatedValues(
  actualPoints: DatedFinancialValue[],
  horizon: number,
): { points: DatedFinancialValue[]; monthlySlope: number | null; method: string; assumptions: string[] } {
  const actual = actualPoints.filter((point) => point.kind === 'actual').sort((a, b) => a.date.localeCompare(b.date))
  if (actual.length < 2) {
    return {
      points: [],
      monthlySlope: null,
      method: 'date-aware linear trend',
      assumptions: ['At least two distinct reporting periods are required.'],
    }
  }
  const first = actual[0]
  const coordinates = actual.map((point) => ({
    month: (new Date(`${point.date}T00:00:00Z`).valueOf() - new Date(`${first.date}T00:00:00Z`).valueOf()) / 2_629_800_000,
    value: point.value,
  }))
  const meanMonth = coordinates.reduce((sum, point) => sum + point.month, 0) / coordinates.length
  const meanValue = coordinates.reduce((sum, point) => sum + point.value, 0) / coordinates.length
  const denominator = coordinates.reduce((sum, point) => sum + (point.month - meanMonth) ** 2, 0)
  if (denominator === 0) {
    return { points: [], monthlySlope: null, method: 'date-aware linear trend', assumptions: ['Reporting periods must have distinct dates.'] }
  }
  const monthlySlope = round(
    coordinates.reduce((sum, point) => sum + (point.month - meanMonth) * (point.value - meanValue), 0) / denominator,
  )
  const latest = actual.at(-1)!
  return {
    points: Array.from({ length: horizon }, (_, index) => ({
      date: addMonths(latest.date, index + 1),
      value: round(latest.value + monthlySlope * (index + 1)),
      kind: 'forecast' as const,
    })),
    monthlySlope,
    method: 'date-aware linear trend',
    assumptions: [
      'Continues the observed reporting-period trend from the latest actual value.',
      'No currency conversion is performed.',
      'Forecast values are estimates, not recorded transactions.',
    ],
  }
}

export function expenseBreakdown(data: Stage3FinancialData): CategoryAmount[] {
  const latest = [...data.reportingPeriods]
    .filter((period) => period.statement_type === 'profit_loss')
    .sort((a, b) => b.period_end.localeCompare(a.period_end))[0]
  if (!latest) return []
  const rows = latest.lines.filter((line) =>
    !line.is_total && ['cost_of_sales', 'operating_expense', 'other_expense'].includes(line.classification),
  )
  const effectiveRows = rows.length > 0
    ? rows
    : latest.lines.filter((line) => ['cost_of_sales', 'operating_expense', 'other_expense'].includes(line.classification))
  const grouped = new Map<string, number>()
  for (const line of effectiveRows) {
    const category = line.canonical_category ?? line.label
    grouped.set(category, (grouped.get(category) ?? 0) + Math.abs(Number(line.amount)))
  }
  const total = [...grouped.values()].reduce((sum, value) => sum + value, 0)
  return [...grouped.entries()]
    .map(([category, amount]) => ({ category, amount: round(amount), percentage: total === 0 ? 0 : round((amount / total) * 100, 1) }))
    .sort((a, b) => b.amount - a.amount)
}

function categoryTotals(period: ReportingPeriodWithLines) {
  const totals = new Map<string, number>()
  for (const line of period.lines.filter((candidate) =>
    !candidate.is_total && ['cost_of_sales', 'operating_expense', 'other_expense'].includes(candidate.classification),
  )) {
    const category = line.canonical_category ?? line.label
    totals.set(category, (totals.get(category) ?? 0) + Math.abs(Number(line.amount)))
  }
  return totals
}

export function detectExpenseChanges(data: Stage3FinancialData): ExpenseChange[] {
  const periods = [...data.reportingPeriods]
    .filter((period) => period.statement_type === 'profit_loss')
    .sort((a, b) => a.period_end.localeCompare(b.period_end))
  const current = periods.at(-1)
  if (!current) return []
  const previous = periods
    .slice(0, -1)
    .reverse()
    .find((period) =>
      period.currency === current.currency &&
      period.source_label === current.source_label
    )
  if (!previous) return []
  const currentTotals = categoryTotals(current)
  const previousTotals = categoryTotals(previous)
  return [...new Set([...currentTotals.keys(), ...previousTotals.keys()])]
    .map((category) => {
      const currentAmount = currentTotals.get(category) ?? 0
      const previousAmount = previousTotals.get(category) ?? 0
      const change = round(currentAmount - previousAmount)
      return {
        category,
        currentAmount: round(currentAmount),
        previousAmount: round(previousAmount),
        change,
        percentageChange: previousAmount === 0 ? null : round((change / Math.abs(previousAmount)) * 100, 1),
      }
    })
    .filter((change) =>
      change.previousAmount === 0
        ? change.currentAmount > 0
        : Math.abs(change.percentageChange ?? 0) >= 10
    )
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

export function rankLargestExpenses(data: Stage3FinancialData): RankedExpense[] {
  const outflows = data.transactions
    .filter((transaction) => transaction.direction === 'outflow')
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
  const latest = outflows.at(-1)
  if (!latest) return []
  return outflows
    .filter((transaction) =>
      transaction.currency === latest.currency &&
      transaction.source_label === latest.source_label
    )
    .map((transaction) => ({
      id: transaction.id,
      label: transaction.description ?? transaction.reference ?? 'Expense transaction',
      counterparty: transaction.counterparty_name,
      date: transaction.transaction_date,
      amount: Math.abs(Number(transaction.total_amount)),
      category: transaction.lines[0]?.canonical_category ?? null,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
}

export function calculateBreakEven(data: Stage3FinancialData): {
  result: BreakEvenSummary | null
  unclassifiedCostAmount: number
  reason: string | null
} {
  const period = [...data.reportingPeriods]
    .filter((candidate) => candidate.statement_type === 'profit_loss')
    .sort((a, b) => b.period_end.localeCompare(a.period_end))[0]
  if (!period) return { result: null, unclassifiedCostAmount: 0, reason: 'A profit-and-loss reporting period is required.' }
  const revenue = amountFor(period, 'revenue') ?? 0
  const costLines = period.lines.filter((line) =>
    !line.is_total && ['cost_of_sales', 'operating_expense', 'other_expense'].includes(line.classification),
  )
  const fixedCosts = costLines.filter((line) => line.cost_behavior === 'fixed').reduce((sum, line) => sum + Math.abs(Number(line.amount)), 0)
  const variableCosts = costLines.filter((line) => line.cost_behavior === 'variable').reduce((sum, line) => sum + Math.abs(Number(line.amount)), 0)
  const unclassifiedCostAmount = costLines
    .filter((line) => line.cost_behavior === 'unclassified' || line.cost_behavior === 'mixed')
    .reduce((sum, line) => sum + Math.abs(Number(line.amount)), 0)
  if (unclassifiedCostAmount > 0) {
    return { result: null, unclassifiedCostAmount: round(unclassifiedCostAmount), reason: 'Classify all fixed, variable, and mixed costs before calculating break-even.' }
  }
  if (revenue <= 0 || fixedCosts <= 0) {
    return { result: null, unclassifiedCostAmount: 0, reason: 'Positive revenue and fixed costs are required for break-even analysis.' }
  }
  const contributionMarginRatio = 1 - variableCosts / revenue
  if (contributionMarginRatio <= 0) {
    return { result: null, unclassifiedCostAmount: 0, reason: 'Variable costs must be lower than revenue to calculate break-even.' }
  }
  const breakEvenRevenue = fixedCosts / contributionMarginRatio
  return {
    result: {
      currency: period.currency,
      revenue: round(revenue),
      fixedCosts: round(fixedCosts),
      variableCosts: round(variableCosts),
      contributionMarginRatio: round(contributionMarginRatio, 4),
      breakEvenRevenue: round(breakEvenRevenue),
      progressPercentage: round((revenue / breakEvenRevenue) * 100, 1),
      unclassifiedCostAmount: 0,
    },
    unclassifiedCostAmount: 0,
    reason: null,
  }
}

function actualForBudgetLine(
  data: Stage3FinancialData,
  line: Stage3FinancialData['budgets'][number]['lines'][number],
  budgetCurrency: string,
  budgetSourceLabel: string,
) {
  const matchingPeriods = data.reportingPeriods.filter((period) =>
    period.currency === budgetCurrency &&
    period.source_label === budgetSourceLabel &&
    period.period_end >= line.period_start &&
    period.period_start <= line.period_end &&
    ((line.kind === 'revenue' || line.kind === 'expense') ? period.statement_type === 'profit_loss' : period.statement_type === 'cash_flow'),
  )
  const classifications = line.kind === 'revenue'
    ? ['revenue']
    : line.kind === 'expense'
      ? ['cost_of_sales', 'operating_expense', 'other_expense']
      : line.kind === 'cash_inflow'
        ? ['cash_inflow']
        : ['cash_outflow']
  return round(matchingPeriods.reduce((sum, period) => {
    let candidates = period.lines
      .filter((candidate) => classifications.includes(candidate.classification))
      .filter((candidate) => !line.canonical_category || candidate.canonical_category === line.canonical_category)

    if (line.account_id) {
      candidates = candidates.filter((candidate) => candidate.account_id === line.account_id)
    } else {
      const components = candidates.filter((candidate) => !candidate.is_total)
      candidates = components.length > 0 ? components : candidates.filter((candidate) => candidate.is_total)
    }

    return sum + candidates.reduce(
      (periodSum, candidate) => periodSum + Math.abs(Number(candidate.amount)),
      0,
    )
  }, 0))
}

export function summarizeBudgetPerformance(
  data: Stage3FinancialData,
  now = new Date(),
): BudgetPerformanceSummary | null {
  const budget = [...data.budgets].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'approved' ? -1 : 1
    return b.period_end.localeCompare(a.period_end)
  })[0]
  if (!budget || budget.lines.length === 0) return null
  const start = new Date(`${budget.period_start}T00:00:00Z`).valueOf()
  const end = new Date(`${budget.period_end}T23:59:59Z`).valueOf()
  const elapsedPercentage = Math.max(0.01, Math.min(1, (now.valueOf() - start) / (end - start)))
  const lines = budget.lines.map((line) => {
    const actualAmount = actualForBudgetLine(data, line, budget.currency, budget.source_label)
    const budgetAmount = Number(line.amount)
    const favourableSign = line.kind === 'expense' || line.kind === 'cash_outflow' ? -1 : 1
    return {
      label: line.label,
      kind: line.kind,
      budgetAmount: round(budgetAmount),
      actualAmount,
      variance: round((actualAmount - budgetAmount) * favourableSign),
      remaining: round(budgetAmount - actualAmount),
    }
  })
  const totalBudget = round(lines.reduce((sum, line) => sum + line.budgetAmount, 0))
  const totalActual = round(lines.reduce((sum, line) => sum + line.actualAmount, 0))
  const projectedActual = round(totalActual / elapsedPercentage)
  return {
    budgetId: budget.id,
    budgetName: budget.name,
    currency: budget.currency,
    periodStart: budget.period_start,
    periodEnd: budget.period_end,
    elapsedPercentage: round(elapsedPercentage * 100, 1),
    lines,
    totalBudget,
    totalActual,
    totalRemaining: round(totalBudget - totalActual),
    projectedActual,
    projectedVariance: round(totalBudget - projectedActual),
  }
}

export function forecastCashBalance(params: {
  snapshot: SourceAwareMetricReadResult
  cashFlows: CashFlowPeriodSummary[]
  horizon: number
}) {
  const openingCash = getMetricNumber(params.snapshot.metrics, 'cash')
  const cashMetric = params.snapshot.metrics.cash
  const latestFlow = params.cashFlows.at(-1)
  const currency = latestFlow?.currency ?? ('currency' in cashMetric ? cashMetric.currency : null)
  const compatibleCash = cashMetric.status === 'available' && latestFlow
    ? cashMetric.currency === latestFlow.currency && cashMetric.provenance.sourceLabel === latestFlow.sourceLabel
    : cashMetric.status === 'available'
  const actualNet = params.cashFlows.flatMap((period) =>
    period.netCashFlow === null ? [] : [{ date: period.periodEnd, value: period.netCashFlow, kind: 'actual' as const }],
  )
  const forecast = forecastDatedValues(actualNet, params.horizon)
  if (openingCash === null || !compatibleCash || forecast.points.length === 0) {
    return {
      openingCash,
      currency,
      points: [],
      method: forecast.method,
      assumptions: !compatibleCash
        ? ['Cash balance and cash-flow history must use the same source and currency.']
        : forecast.assumptions,
    }
  }
  let balance = openingCash
  return {
    openingCash,
    currency,
    points: forecast.points.map((point) => {
      balance = round(balance + point.value)
      return { ...point, value: balance }
    }),
    method: forecast.method,
    assumptions: ['Starts from the latest trusted cash balance.', ...forecast.assumptions],
  }
}
