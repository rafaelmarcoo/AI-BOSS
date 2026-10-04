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
  if (snapshot.detailed) {
    const hasProfitAndLoss = snapshot.detailed.reportingPeriods.some(
      (period) => period.statementType === 'profit_loss',
    )
    const capabilities = new Set(snapshot.detailed.capabilities)
    if (!hasProfitAndLoss) capabilities.add('profit_loss_summary')
    if (snapshot.detailed.reportingPeriods.some((period) => period.statementType === 'balance_sheet')) {
      capabilities.add('balance_sheet')
    }
    if ((snapshot.detailed.debts?.length ?? 0) > 0) capabilities.add('debt_details')
    if (snapshot.detailed.debts?.some((debt) => debt.repayments.length > 0)) {
      capabilities.add('debt_repayment_schedule')
    }
    if ((snapshot.detailed.revenueEntries?.length ?? 0) > 0) capabilities.add('customer_revenue')
    if ((snapshot.detailed.revenueDimensions?.length ?? 0) > 0) capabilities.add('revenue_dimensions')
    return {
      ...snapshot.detailed,
      capabilities: [...capabilities],
      reportingPeriods: hasProfitAndLoss
        ? snapshot.detailed.reportingPeriods
        : [...snapshot.detailed.reportingPeriods, minimalProfitAndLoss(snapshot)],
      invoices: snapshot.detailed.invoices ?? [],
      debts: snapshot.detailed.debts ?? [],
      customers: snapshot.detailed.customers ?? [],
      revenueDimensions: snapshot.detailed.revenueDimensions ?? [],
      revenueEntries: snapshot.detailed.revenueEntries ?? [],
    }
  }
  return {
    capabilities: ['profit_loss_summary'],
    accounts: [],
    reportingPeriods: [minimalProfitAndLoss(snapshot)],
    transactions: [],
    budgets: [],
    invoices: [],
    debts: [],
    customers: [],
    revenueDimensions: [],
    revenueEntries: [],
  }
}

export async function saveAccountingReadModels(params: {
  userId: string
  companyId: string
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
      company_id: params.companyId,
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
  const customerIds = new Map<string, string>()
  const dimensionIds = new Map<string, string>()
  const invoiceIds = new Map<string, string>()
  const transactionIds = new Map<string, string>()

  try {
    for (const account of dataset.accounts) {
      const { data, error } = await supabase
        .from('financial_accounts')
        .upsert({
          user_id: params.userId,
          company_id: params.companyId,
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
        }, { onConflict: 'company_id,source_type,provider_account_id' })
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
          company_id: params.companyId,
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
        }, { onConflict: 'company_id,source_type,statement_type,period_start,period_end,currency' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Reporting period upsert returned no row.')
      const periodId = data.id as string
      const periodLines = period.lines.map((line) => ({
          reporting_period_id: periodId,
          user_id: params.userId,
          company_id: params.companyId,
          account_id: line.providerAccountId ? accountIds.get(line.providerAccountId) ?? null : null,
          line_key: line.lineKey,
          label: line.label,
          classification: line.classification,
          quick_ratio_treatment: line.quickRatioTreatment ?? 'not_applicable',
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
          company_id: params.companyId,
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
        }, { onConflict: 'company_id,source_type,provider_transaction_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Transaction upsert returned no row.')
      const transactionId = data.id as string
      transactionIds.set(transaction.providerTransactionId, transactionId)
      const transactionLines = transaction.lines.map((line) => ({
          transaction_id: transactionId,
          user_id: params.userId,
          company_id: params.companyId,
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
          company_id: params.companyId,
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
        }, { onConflict: 'company_id,source_type,provider_budget_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Budget upsert returned no row.')
      const budgetId = data.id as string
      const budgetLines = budget.lines.map((line) => ({
          budget_id: budgetId,
          user_id: params.userId,
          company_id: params.companyId,
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

    for (const customer of dataset.customers ?? []) {
      const { data, error } = await supabase
        .from('financial_customers')
        .upsert({
          user_id: params.userId,
          company_id: params.companyId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          provider_customer_id: customer.providerCustomerId,
          customer_name: customer.name,
          status: customer.status ?? 'active',
          raw_data: customer.raw ?? {},
        }, { onConflict: 'company_id,source_type,provider_customer_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Customer upsert returned no row.')
      customerIds.set(customer.providerCustomerId, data.id as string)
    }

    for (const dimension of dataset.revenueDimensions ?? []) {
      const { data, error } = await supabase
        .from('financial_revenue_dimensions')
        .upsert({
          user_id: params.userId,
          company_id: params.companyId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          provider_dimension_id: dimension.providerDimensionId,
          dimension_type: dimension.dimensionType,
          dimension_group: dimension.dimensionGroup,
          dimension_name: dimension.name,
          status: dimension.status ?? 'active',
          raw_data: dimension.raw ?? {},
        }, { onConflict: 'company_id,source_type,dimension_type,dimension_group,provider_dimension_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Revenue dimension upsert returned no row.')
      dimensionIds.set(
        `${dimension.dimensionType}\u0000${dimension.dimensionGroup}\u0000${dimension.providerDimensionId}`,
        data.id as string,
      )
    }

    for (const invoice of dataset.invoices ?? []) {
      const { data, error } = await supabase
        .from('financial_invoices')
        .upsert({
          user_id: params.userId,
          company_id: params.companyId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          provider_invoice_id: invoice.providerInvoiceId,
          invoice_kind: invoice.invoiceKind,
          status: invoice.status,
          invoice_number: invoice.invoiceNumber ?? null,
          counterparty_name: invoice.counterpartyName ?? null,
          issue_date: invoice.issueDate,
          due_date: invoice.dueDate,
          currency: invoice.currency,
          total_amount: Math.abs(invoice.totalAmount),
          amount_paid: Math.abs(invoice.amountPaid),
          outstanding_amount: Math.abs(invoice.outstandingAmount),
          fully_paid_at: invoice.fullyPaidAt ?? null,
          raw_data: invoice.raw ?? {},
        }, { onConflict: 'company_id,source_type,provider_invoice_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Invoice upsert returned no row.')
      const invoiceId = data.id as string
      invoiceIds.set(invoice.providerInvoiceId, invoiceId)
      const invoiceLines = invoice.lines.map((line) => ({
        invoice_id: invoiceId,
        user_id: params.userId,
        company_id: params.companyId,
        account_id: line.providerAccountId ? accountIds.get(line.providerAccountId) ?? null : null,
        line_key: line.lineKey,
        description: line.description ?? null,
        canonical_category: line.canonicalCategory ?? null,
        quantity: line.quantity ?? null,
        unit_amount: line.unitAmount ?? null,
        tax_amount: Math.abs(line.taxAmount ?? 0),
        line_amount: Math.abs(line.lineAmount),
        raw_data: line.raw ?? {},
      }))
      if (invoiceLines.length > 0) {
        const { error: lineError } = await supabase.from('financial_invoice_lines').upsert(
          invoiceLines,
          { onConflict: 'invoice_id,line_key' },
        )
        if (lineError) throw lineError
      }

      const payments = invoice.payments.map((payment) => ({
        invoice_id: invoiceId,
        user_id: params.userId,
        company_id: params.companyId,
        provider_payment_id: payment.providerPaymentId,
        payment_date: payment.paymentDate,
        status: payment.status ?? 'posted',
        currency: payment.currency,
        amount: Math.abs(payment.amount),
        reference: payment.reference ?? null,
        raw_data: payment.raw ?? {},
      }))
      if (payments.length > 0) {
        const { error: paymentError } = await supabase.from('financial_invoice_payments').upsert(
          payments,
          { onConflict: 'invoice_id,provider_payment_id' },
        )
        if (paymentError) throw paymentError
      }
    }

    for (const debt of dataset.debts ?? []) {
      const { data, error } = await supabase
        .from('financial_debts')
        .upsert({
          user_id: params.userId,
          company_id: params.companyId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          provider_debt_id: debt.providerDebtId,
          debt_name: debt.name,
          lender_name: debt.lenderName ?? null,
          debt_type: debt.debtType,
          status: debt.status,
          currency: debt.currency,
          original_principal: debt.originalPrincipal ?? null,
          current_balance: Math.abs(debt.currentBalance),
          annual_interest_rate: debt.annualInterestRate ?? null,
          start_date: debt.startDate ?? null,
          maturity_date: debt.maturityDate ?? null,
          minimum_payment: debt.minimumPayment ?? null,
          account_id: debt.providerAccountId ? accountIds.get(debt.providerAccountId) ?? null : null,
          raw_data: debt.raw ?? {},
        }, { onConflict: 'company_id,source_type,provider_debt_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Debt upsert returned no row.')
      const debtId = data.id as string
      const repayments = debt.repayments.map((repayment) => ({
        debt_id: debtId,
        user_id: params.userId,
        company_id: params.companyId,
        provider_repayment_id: repayment.providerRepaymentId,
        due_date: repayment.dueDate,
        status: repayment.status ?? 'scheduled',
        principal_amount: Math.abs(repayment.principalAmount),
        interest_amount: Math.abs(repayment.interestAmount),
        total_amount: Math.abs(repayment.totalAmount),
        paid_at: repayment.paidAt ?? null,
        raw_data: repayment.raw ?? {},
      }))
      if (repayments.length > 0) {
        const { error: repaymentError } = await supabase.from('financial_debt_repayments').upsert(
          repayments,
          { onConflict: 'debt_id,provider_repayment_id' },
        )
        if (repaymentError) throw repaymentError
      }
    }

    for (const revenue of dataset.revenueEntries ?? []) {
      const { data, error } = await supabase
        .from('financial_revenue_entries')
        .upsert({
          user_id: params.userId,
          company_id: params.companyId,
          connection_id: params.connectionId,
          sync_run_id: syncRunId,
          source_type: params.provider,
          source_label: params.sourceLabel,
          provider_revenue_id: revenue.providerRevenueId,
          revenue_date: revenue.revenueDate,
          status: revenue.status ?? 'posted',
          currency: revenue.currency,
          amount: revenue.amount,
          customer_id: revenue.providerCustomerId ? customerIds.get(revenue.providerCustomerId) ?? null : null,
          invoice_id: revenue.providerInvoiceId ? invoiceIds.get(revenue.providerInvoiceId) ?? null : null,
          transaction_id: revenue.providerTransactionId ? transactionIds.get(revenue.providerTransactionId) ?? null : null,
          description: revenue.description ?? null,
          raw_data: revenue.raw ?? {},
        }, { onConflict: 'company_id,source_type,provider_revenue_id' })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Revenue entry upsert returned no row.')
      const revenueEntryId = data.id as string
      const links = revenue.dimensions.flatMap((dimension) => {
        const dimensionId = dimensionIds.get(
          `${dimension.dimensionType}\u0000${dimension.dimensionGroup}\u0000${dimension.providerDimensionId}`,
        )
        return dimensionId ? [{
          revenue_entry_id: revenueEntryId,
          user_id: params.userId,
          company_id: params.companyId,
          dimension_id: dimensionId,
          dimension_type: dimension.dimensionType,
          dimension_group: dimension.dimensionGroup,
          raw_data: dimension.raw ?? {},
        }] : []
      })
      if (links.length > 0) {
        const { error: linkError } = await supabase.from('financial_revenue_entry_dimensions').upsert(
          links,
          { onConflict: 'revenue_entry_id,dimension_type,dimension_group' },
        )
        if (linkError) throw linkError
      }
    }

    const recordCounts = {
      accounts: dataset.accounts.length,
      reportingPeriods: dataset.reportingPeriods.length,
      transactions: dataset.transactions.length,
      budgets: dataset.budgets.length,
      invoices: dataset.invoices?.length ?? 0,
      debts: dataset.debts?.length ?? 0,
      customers: dataset.customers?.length ?? 0,
      revenueDimensions: dataset.revenueDimensions?.length ?? 0,
      revenueEntries: dataset.revenueEntries?.length ?? 0,
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
