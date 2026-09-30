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
} from '@/types/database'
import type {
  BudgetWithLines,
  ReportingPeriodWithLines,
  Stage3FinancialData,
  TransactionWithLines,
} from './types'

export const EMPTY_STAGE3_FINANCIAL_DATA: Stage3FinancialData = {
  accounts: [],
  reportingPeriods: [],
  transactions: [],
  budgets: [],
}

export async function readStage3FinancialData(userId: string): Promise<Stage3FinancialData> {
  const supabase = createAdminSupabaseClient()
  const [accountsResult, periodsResult, transactionsResult, budgetsResult] = await Promise.all([
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
  ])

  const firstError = [accountsResult, periodsResult, transactionsResult, budgetsResult]
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

  return {
    accounts: (accountsResult.data ?? []) as FinancialAccount[],
    reportingPeriods,
    transactions,
    budgets,
  }
}
