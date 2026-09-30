import 'server-only'

import { createAdminSupabaseClient } from '@/lib/supabase'
import type {
  AccountingProvider,
  NormalizedAccountingDataset,
  NormalizedFinancialData,
  NormalizedReportingPeriodRecord,
} from '@/lib/integrations/types'

function minimalProfitAndLoss(snapshot: NormalizedFinancialData): NormalizedReportingPeriodRecord {
  const periodStart = `${snapshot.asOf.slice(0, 7)}-01`
  return {
    statementType: 'profit_loss',
    periodStart,
    periodEnd: snapshot.asOf,
    currency: snapshot.currency,
    lines: [
      {
        lineKey: 'summary:revenue',
        label: 'Revenue',
        classification: 'revenue',
        amount: Math.abs(snapshot.monthlyRevenue),
        isTotal: true,
        sortOrder: 10,
      },
      {
        lineKey: 'summary:operating-expenses',
        label: 'Operating expenses',
        classification: 'operating_expense',
        amount: Math.abs(snapshot.monthlyExpenses),
        costBehavior: 'unclassified',
        isTotal: true,
        sortOrder: 20,
      },
      {
        lineKey: 'summary:operating-profit',
        label: 'Operating profit',
        classification: 'operating_profit',
        amount: snapshot.monthlyRevenue - snapshot.monthlyExpenses,
        isTotal: true,
        sortOrder: 30,
      },
    ],
    raw: snapshot.raw,
  }
}

function datasetFor(snapshot: NormalizedFinancialData): NormalizedAccountingDataset {
  if (snapshot.detailed) return snapshot.detailed
  return {
    capabilities: ['profit_loss_summary'],
    accounts: [],
    reportingPeriods: [minimalProfitAndLoss(snapshot)],
    transactions: [],
    budgets: [],
  }
}

export async function saveAccountingReadModels(params: {
  userId: string
  connectionId: string
  provider: AccountingProvider
  sourceLabel: string
  snapshot: NormalizedFinancialData
}) {
  const supabase = createAdminSupabaseClient()
  const dataset = datasetFor(params.snapshot)
  const startedAt = new Date().toISOString()
  const { data: syncRun, error: syncError } = await supabase
    .from('financial_sync_runs')
    .insert({
      user_id: params.userId,
      connection_id: params.connectionId,
      provider: params.provider,
      status: 'running',
      started_at: startedAt,
      source_as_of_date: params.snapshot.asOf,
      capabilities: dataset.capabilities,
    })
    .select('id')
    .single()
  if (syncError || !syncRun) {
    throw new Error(`Failed to start detailed accounting sync: ${syncError?.message ?? 'No sync run returned.'}`)
  }

  const syncRunId = syncRun.id as string
  const accountIds = new Map<string, string>()

  try {
    for (const account of dataset.accounts) {
      const { data, error } = await supabase
        .from('financial_accounts')
        .upsert({
          user_id: params.userId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          provider_account_id: account.providerAccountId,
          account_code: account.code ?? null,
          account_name: account.name,
          account_class: account.accountClass,
          account_subtype: account.subtype ?? null,
          canonical_category: account.canonicalCategory ?? null,
          cost_behavior: account.costBehavior ?? 'unclassified',
          currency: account.currency ?? params.snapshot.currency,
          is_active: account.isActive ?? true,
          raw_data: account.raw ?? {},
        }, { onConflict: 'user_id,source_type,provider_account_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Account upsert returned no row.')
      accountIds.set(account.providerAccountId, data.id as string)
    }

    for (const period of dataset.reportingPeriods) {
      const { data, error } = await supabase
        .from('financial_reporting_periods')
        .upsert({
          user_id: params.userId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          statement_type: period.statementType,
          period_start: period.periodStart,
          period_end: period.periodEnd,
          currency: period.currency,
          generated_at: period.generatedAt ?? startedAt,
          raw_data: period.raw ?? {},
        }, { onConflict: 'user_id,source_type,statement_type,period_start,period_end,currency' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Reporting period upsert returned no row.')
      const periodId = data.id as string
      const periodLines = period.lines.map((line) => ({
          reporting_period_id: periodId,
          user_id: params.userId,
          account_id: line.providerAccountId ? accountIds.get(line.providerAccountId) ?? null : null,
          line_key: line.lineKey,
          label: line.label,
          classification: line.classification,
          canonical_category: line.canonicalCategory ?? null,
          amount: line.amount,
          cost_behavior: line.costBehavior ?? 'unclassified',
          is_total: line.isTotal ?? false,
          sort_order: line.sortOrder ?? 0,
          raw_data: line.raw ?? {},
        }))
      if (periodLines.length > 0) {
        const { error: lineError } = await supabase.from('financial_statement_lines').upsert(
          periodLines,
          { onConflict: 'reporting_period_id,line_key' },
        )
        if (lineError) throw lineError
      }
    }

    for (const transaction of dataset.transactions) {
      const { data, error } = await supabase
        .from('financial_transactions')
        .upsert({
          user_id: params.userId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          provider_transaction_id: transaction.providerTransactionId,
          transaction_type: transaction.transactionType,
          transaction_date: transaction.transactionDate,
          status: transaction.status,
          direction: transaction.direction,
          reference: transaction.reference ?? null,
          counterparty_name: transaction.counterpartyName ?? null,
          description: transaction.description ?? null,
          currency: transaction.currency,
          total_amount: Math.abs(transaction.totalAmount),
          raw_data: transaction.raw ?? {},
        }, { onConflict: 'user_id,source_type,provider_transaction_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Transaction upsert returned no row.')
      const transactionId = data.id as string
      const transactionLines = transaction.lines.map((line) => ({
          transaction_id: transactionId,
          user_id: params.userId,
          account_id: line.providerAccountId ? accountIds.get(line.providerAccountId) ?? null : null,
          line_key: line.lineKey,
          description: line.description ?? null,
          canonical_category: line.canonicalCategory ?? null,
          amount: Math.abs(line.amount),
          tax_amount: Math.abs(line.taxAmount ?? 0),
          raw_data: line.raw ?? {},
        }))
      if (transactionLines.length > 0) {
        const { error: lineError } = await supabase.from('financial_transaction_lines').upsert(
          transactionLines,
          { onConflict: 'transaction_id,line_key' },
        )
        if (lineError) throw lineError
      }
    }

    for (const budget of dataset.budgets) {
      const { data, error } = await supabase
        .from('financial_budgets')
        .upsert({
          user_id: params.userId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          provider_budget_id: budget.providerBudgetId,
          name: budget.name,
          status: budget.status,
          period_start: budget.periodStart,
          period_end: budget.periodEnd,
          currency: budget.currency,
          raw_data: budget.raw ?? {},
        }, { onConflict: 'user_id,source_type,provider_budget_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Budget upsert returned no row.')
      const budgetId = data.id as string
      const budgetLines = budget.lines.map((line) => ({
          budget_id: budgetId,
          user_id: params.userId,
          account_id: line.providerAccountId ? accountIds.get(line.providerAccountId) ?? null : null,
          line_key: line.lineKey,
          label: line.label,
          kind: line.kind,
          canonical_category: line.canonicalCategory ?? null,
          period_start: line.periodStart,
          period_end: line.periodEnd,
          amount: Math.abs(line.amount),
          raw_data: line.raw ?? {},
        }))
      if (budgetLines.length > 0) {
        const { error: lineError } = await supabase.from('financial_budget_lines').upsert(
          budgetLines,
          { onConflict: 'budget_id,line_key,period_start,period_end' },
        )
        if (lineError) throw lineError
      }
    }

    const recordCounts = {
      accounts: dataset.accounts.length,
      reportingPeriods: dataset.reportingPeriods.length,
      transactions: dataset.transactions.length,
      budgets: dataset.budgets.length,
    }
    await supabase.from('financial_sync_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      record_counts: recordCounts,
    }).eq('id', syncRunId)
    return recordCounts
  } catch (error) {
    await supabase.from('financial_sync_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Detailed accounting sync failed.',
    }).eq('id', syncRunId)
    throw error
  }
}
