import 'server-only'

import { createAdminSupabaseClient } from '@/lib/supabase'
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
  FinancialDebt,
  FinancialDebtRepayment,
} from '@/types/database'
import type {
  BudgetWithLines,
  ReportingPeriodWithLines,
  Stage3FinancialData,
  TransactionWithLines,
  InvoiceWithDetails,
  DebtWithRepayments,
} from './types'

export const EMPTY_STAGE3_FINANCIAL_DATA: Stage3FinancialData = {
  capabilities: [],
  accounts: [],
  reportingPeriods: [],
  transactions: [],
  budgets: [],
  invoices: [],
  debts: [],
}

export async function readStage3FinancialData(userId: string): Promise<Stage3FinancialData> {
  const supabase = createAdminSupabaseClient()
  const [syncRunsResult, accountsResult, periodsResult, transactionsResult, budgetsResult, invoicesResult, debtsResult] = await Promise.all([
    supabase
      .from('financial_sync_runs')
      .select('capabilities')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(20),
    supabase.from('financial_accounts').select('*').eq('user_id', userId).eq('is_active', true),
    supabase
      .from('financial_reporting_periods')
      .select('*, financial_statement_lines(*)')
      .eq('user_id', userId)
      .order('period_end', { ascending: true }),
    supabase
      .from('financial_transactions')
      .select('*, financial_transaction_lines(*)')
      .eq('user_id', userId)
      .eq('status', 'posted')
      .order('transaction_date', { ascending: false })
      .limit(500),
    supabase
      .from('financial_budgets')
      .select('*, financial_budget_lines(*)')
      .eq('user_id', userId)
      .in('status', ['approved', 'draft'])
      .order('period_end', { ascending: false }),
    supabase
      .from('financial_invoices')
      .select('*, financial_invoice_lines(*), financial_invoice_payments(*)')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .limit(1000),
    supabase
      .from('financial_debts')
      .select('*, financial_debt_repayments(*)')
      .eq('user_id', userId)
      .order('maturity_date', { ascending: true, nullsFirst: false }),
  ])

  const firstError = [syncRunsResult, accountsResult, periodsResult, transactionsResult, budgetsResult, invoicesResult, debtsResult]
    .map((result) => result.error)
    .find(Boolean)
  if (firstError) {
    throw new Error(`Failed to load Stage 3 financial data: ${firstError.message}`)
  }

  const reportingPeriods = (periodsResult.data ?? []).map((row) => {
    const record = row as FinancialReportingPeriod & {
      financial_statement_lines?: FinancialStatementLine[]
    }
    const { financial_statement_lines: lines = [], ...period } = record
    return { ...period, lines } satisfies ReportingPeriodWithLines
  })
  const transactions = (transactionsResult.data ?? []).map((row) => {
    const record = row as FinancialTransaction & {
      financial_transaction_lines?: FinancialTransactionLine[]
    }
    const { financial_transaction_lines: lines = [], ...transaction } = record
    return { ...transaction, lines } satisfies TransactionWithLines
  })
  const budgets = (budgetsResult.data ?? []).map((row) => {
    const record = row as FinancialBudget & {
      financial_budget_lines?: FinancialBudgetLine[]
    }
    const { financial_budget_lines: lines = [], ...budget } = record
    return { ...budget, lines } satisfies BudgetWithLines
  })
  const invoices = (invoicesResult.data ?? []).map((row) => {
    const record = row as FinancialInvoice & {
      financial_invoice_lines?: FinancialInvoiceLine[]
      financial_invoice_payments?: FinancialInvoicePayment[]
    }
    const {
      financial_invoice_lines: lines = [],
      financial_invoice_payments: payments = [],
      ...invoice
    } = record
    return { ...invoice, lines, payments } satisfies InvoiceWithDetails
  })
  const debts = (debtsResult.data ?? []).map((row) => {
    const record = row as FinancialDebt & {
      financial_debt_repayments?: FinancialDebtRepayment[]
    }
    const { financial_debt_repayments: repayments = [], ...debt } = record
    return { ...debt, repayments } satisfies DebtWithRepayments
  })

  return {
    capabilities: [...new Set((syncRunsResult.data ?? []).flatMap((row) =>
      Array.isArray(row.capabilities) ? row.capabilities as string[] : []
    ))],
    accounts: (accountsResult.data ?? []) as FinancialAccount[],
    reportingPeriods,
    transactions,
    budgets,
    invoices,
    debts,
  }
}
