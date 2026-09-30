import type {
  FinancialAccount,
  FinancialBudget,
  FinancialBudgetLine,
  FinancialReportingPeriod,
  FinancialStatementLine,
  FinancialTransaction,
  FinancialTransactionLine,
  FinancialInvoice,
  FinancialInvoiceLine,
  FinancialInvoicePayment,
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

export interface InvoiceWithDetails extends FinancialInvoice {
  lines: FinancialInvoiceLine[]
  payments: FinancialInvoicePayment[]
}

export interface Stage3FinancialData {
  capabilities: string[]
  accounts: FinancialAccount[]
  reportingPeriods: ReportingPeriodWithLines[]
  transactions: TransactionWithLines[]
  budgets: BudgetWithLines[]
  invoices: InvoiceWithDetails[]
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

export interface InvoiceBalanceItem {
  id: string
  invoiceNumber: string | null
  counterpartyName: string | null
  issueDate: string
  dueDate: string
  outstandingAmount: number
  daysOverdue: number | null
}

export interface InvoiceBalanceGroup {
  currency: string
  sourceLabel: string
  count: number
  totalOutstanding: number
  items: InvoiceBalanceItem[]
}

export interface InvoiceAgeingBucket {
  key: 'days_0_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus'
  label: string
  count: number
  amount: number
  percentage: number
}

export interface InvoiceAgeingGroup {
  currency: string
  sourceLabel: string
  totalOutstanding: number
  buckets: InvoiceAgeingBucket[]
}
