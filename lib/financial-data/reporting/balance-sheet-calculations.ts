import type { FinancialStatementClassification } from '@/types/database'
import type { DebtWithRepayments, ReportingPeriodWithLines, Stage3FinancialData } from './types'

function round(value: number, precision = 2) {
  return Number(value.toFixed(precision))
}

function componentLines(period: ReportingPeriodWithLines, classifications: FinancialStatementClassification[]) {
  return period.lines.filter((line) => classifications.includes(line.classification) && !line.is_total)
}

function classifiedAmount(period: ReportingPeriodWithLines, classification: FinancialStatementClassification) {
  const matching = period.lines.filter((line) => line.classification === classification)
  const totals = matching.filter((line) => line.is_total).map((line) => Math.abs(Number(line.amount)))
  if (totals.length > 0) return Math.max(...totals)
  return matching.reduce((sum, line) => sum + Math.abs(Number(line.amount)), 0)
}

function categoryItems(
  period: ReportingPeriodWithLines,
  classifications: FinancialStatementClassification[],
  fallbackLabel: string,
  explicitTotalClassification: FinancialStatementClassification,
) {
  const lines = componentLines(period, classifications)
  const totals = period.lines.filter((line) => classifications.includes(line.classification) && line.is_total)
  const explicitTotals = totals.filter((line) => line.classification === explicitTotalClassification)
  const source = lines.length > 0
    ? lines
    : explicitTotals.length > 0
      ? [explicitTotals.reduce((largest, line) => Number(line.amount) > Number(largest.amount) ? line : largest)]
      : totals
  const amounts = new Map<string, { label: string; amount: number }>()
  for (const line of source) {
    const category = line.canonical_category || line.label || fallbackLabel
    const current = amounts.get(category) ?? { label: line.label || fallbackLabel, amount: 0 }
    current.amount += Math.abs(Number(line.amount))
    amounts.set(category, current)
  }
  const total = [...amounts.values()].reduce((sum, item) => sum + item.amount, 0)
  return {
    total: round(total),
    items: [...amounts.entries()]
      .map(([category, item]) => ({
        label: item.label,
        category,
        amount: round(item.amount),
        percentage: total === 0 ? 0 : round((item.amount / total) * 100, 1),
      }))
      .sort((left, right) => right.amount - left.amount),
  }
}

function latestBalanceSheets(data: Stage3FinancialData) {
  const latest = new Map<string, ReportingPeriodWithLines>()
  for (const period of data.reportingPeriods.filter((item) => item.statement_type === 'balance_sheet')) {
    const key = `${period.source_label}\u0000${period.currency}`
    const current = latest.get(key)
    if (!current || period.period_end > current.period_end) latest.set(key, period)
  }
  return [...latest.values()].sort((left, right) => left.source_label.localeCompare(right.source_label))
}

export function summarizeBalanceSheetMetrics(data: Stage3FinancialData) {
  return latestBalanceSheets(data).map((period) => {
    const currentAssets = classifiedAmount(period, 'current_asset')
    const currentLiabilities = classifiedAmount(period, 'current_liability')
    const currentAssetComponents = componentLines(period, ['current_asset'])
    const currentAssetTotals = period.lines.filter((line) => line.classification === 'current_asset' && line.is_total)
    const unclassifiedQuickAssetCount = currentAssetComponents.filter(
      (line) => line.quick_ratio_treatment === 'unclassified',
    ).length + (currentAssetComponents.length === 0 && currentAssetTotals.length > 0 ? 1 : 0)
    const quickAssets = unclassifiedQuickAssetCount > 0
      ? null
      : currentAssetComponents
          .filter((line) => line.quick_ratio_treatment === 'include')
          .reduce((sum, line) => sum + Math.abs(Number(line.amount)), 0)
    const quickRatioStatus = currentLiabilities <= 0
      ? 'no_current_liabilities' as const
      : unclassifiedQuickAssetCount > 0
        ? 'unclassified_current_assets' as const
        : 'ready' as const
    return {
      sourceLabel: period.source_label,
      currency: period.currency,
      asOfDate: period.period_end,
      currentAssets: round(currentAssets),
      currentLiabilities: round(currentLiabilities),
      workingCapital: round(currentAssets - currentLiabilities),
      currentRatio: currentLiabilities > 0 ? round(currentAssets / currentLiabilities, 3) : null,
      quickAssets: quickAssets === null ? null : round(quickAssets),
      quickRatio: quickRatioStatus === 'ready' && quickAssets !== null
        ? round(quickAssets / currentLiabilities, 3)
        : null,
      quickRatioStatus,
      unclassifiedQuickAssetCount,
    }
  })
}

export function summarizeBalanceSheetCategories(
  data: Stage3FinancialData,
  kind: 'assets' | 'liabilities' | 'equity',
) {
  const classifications: FinancialStatementClassification[] = kind === 'assets'
    ? ['current_asset', 'non_current_asset', 'total_assets']
    : kind === 'liabilities'
      ? ['current_liability', 'non_current_liability', 'total_liabilities']
      : ['equity', 'total_equity']
  const totalClassification: FinancialStatementClassification = kind === 'assets'
    ? 'total_assets'
    : kind === 'liabilities'
      ? 'total_liabilities'
      : 'total_equity'
  return latestBalanceSheets(data).map((period) => ({
    sourceLabel: period.source_label,
    currency: period.currency,
    asOfDate: period.period_end,
    ...categoryItems(period, classifications, kind, totalClassification),
  }))
}

function activeDebts(data: Stage3FinancialData) {
  return data.debts.filter((debt) => debt.status === 'active' && Number(debt.current_balance) > 0)
}

function debtGroupKey(debt: DebtWithRepayments) {
  return `${debt.source_label}\u0000${debt.currency}`
}

export function summarizeDebtOverview(data: Stage3FinancialData) {
  const groups = new Map<string, ReturnType<typeof debtOverviewGroup>>()
  for (const debt of activeDebts(data)) {
    const key = debtGroupKey(debt)
    const group = groups.get(key) ?? debtOverviewGroup(debt)
    group.totalBalance += Number(debt.current_balance)
    group.debts.push({
      id: debt.id,
      name: debt.debt_name,
      lenderName: debt.lender_name,
      debtType: debt.debt_type,
      currentBalance: round(Number(debt.current_balance)),
      annualInterestRate: debt.annual_interest_rate === null ? null : Number(debt.annual_interest_rate),
      maturityDate: debt.maturity_date,
      minimumPayment: debt.minimum_payment === null ? null : Number(debt.minimum_payment),
    })
    groups.set(key, group)
  }
  return [...groups.values()].map((group) => ({
    ...group,
    totalBalance: round(group.totalBalance),
    debts: group.debts.sort((left, right) => right.currentBalance - left.currentBalance),
  }))
}

function debtOverviewGroup(debt: DebtWithRepayments) {
  return {
    sourceLabel: debt.source_label,
    currency: debt.currency,
    totalBalance: 0,
    debts: [] as Array<{
      id: string
      name: string
      lenderName: string | null
      debtType: DebtWithRepayments['debt_type']
      currentBalance: number
      annualInterestRate: number | null
      maturityDate: string | null
      minimumPayment: number | null
    }>,
  }
}

export function summarizeDebtRepayments(params: {
  data: Stage3FinancialData
  asOfDate: string
  throughDate: string
}) {
  const groups = new Map<string, {
    sourceLabel: string
    currency: string
    totalScheduled: number
    repayments: Array<{
      id: string
      debtName: string
      dueDate: string
      principalAmount: number
      interestAmount: number
      totalAmount: number
    }>
  }>()
  for (const debt of activeDebts(params.data)) {
    for (const repayment of debt.repayments) {
      if (repayment.status !== 'scheduled' || repayment.due_date < params.asOfDate || repayment.due_date > params.throughDate) continue
      const key = debtGroupKey(debt)
      const group = groups.get(key) ?? {
        sourceLabel: debt.source_label,
        currency: debt.currency,
        totalScheduled: 0,
        repayments: [],
      }
      group.totalScheduled += Number(repayment.total_amount)
      group.repayments.push({
        id: repayment.id,
        debtName: debt.debt_name,
        dueDate: repayment.due_date,
        principalAmount: round(Number(repayment.principal_amount)),
        interestAmount: round(Number(repayment.interest_amount)),
        totalAmount: round(Number(repayment.total_amount)),
      })
      groups.set(key, group)
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    totalScheduled: round(group.totalScheduled),
    repayments: group.repayments.sort((left, right) => left.dueDate.localeCompare(right.dueDate)),
  }))
}
