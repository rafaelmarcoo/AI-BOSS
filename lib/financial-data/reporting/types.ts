import type {
  FinancialAccount,
  FinancialBudget,
  FinancialBudgetLine,
  FinancialReportingPeriod,
  FinancialStatementLine,
  FinancialTransaction,
  FinancialTransactionLine,
} from '@/types/database'

export interface ReportingPeriodWithLines extends FinancialReportingPeriod {
  lines: FinancialStatementLine[]
}

export interface TransactionWithLines extends FinancialTransaction {
  lines: FinancialTransactionLine[]
}

export interface BudgetWithLines extends FinancialBudget {
  lines: FinancialBudgetLine[]
}

export interface Stage3FinancialData {
  accounts: FinancialAccount[]
  reportingPeriods: ReportingPeriodWithLines[]
  transactions: TransactionWithLines[]
  budgets: BudgetWithLines[]
}

export interface DatedFinancialValue {
  date: string
  value: number
  kind: 'actual' | 'forecast'
}

export interface ProfitPeriodSummary {
  periodStart: string
  periodEnd: string
  currency: string
  revenue: number | null
  costOfSales: number | null
  operatingExpenses: number | null
  grossProfit: number | null
  operatingProfit: number | null
  netProfit: number | null
  sourceLabel: string
}

export interface CashFlowPeriodSummary {
  periodStart: string
  periodEnd: string
  currency: string
  inflow: number | null
  outflow: number | null
  netCashFlow: number | null
  sourceLabel: string
}

export interface CategoryAmount {
  category: string
  amount: number
  percentage: number
}

export interface ExpenseChange {
  category: string
  currentAmount: number
  previousAmount: number
  change: number
  percentageChange: number | null
}

export interface RankedExpense {
  id: string
  label: string
  counterparty: string | null
  date: string
  amount: number
  category: string | null
}

export interface BreakEvenSummary {
  currency: string
  revenue: number
  fixedCosts: number
  variableCosts: number
  contributionMarginRatio: number
  breakEvenRevenue: number
  progressPercentage: number
  unclassifiedCostAmount: number
}

export interface BudgetPerformanceLine {
  label: string
  kind: 'revenue' | 'expense' | 'cash_inflow' | 'cash_outflow'
  budgetAmount: number
  actualAmount: number
  variance: number
  remaining: number
}

export interface BudgetPerformanceSummary {
  budgetId: string
  budgetName: string
  currency: string
  periodStart: string
  periodEnd: string
  elapsedPercentage: number
  lines: BudgetPerformanceLine[]
  totalBudget: number
  totalActual: number
  totalRemaining: number
  projectedActual: number
  projectedVariance: number
}

