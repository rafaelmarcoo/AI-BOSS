/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrations = [
  '024_stage3_financial_read_models.sql',
  '025_stage4_invoices_and_bills.sql',
  '026_stage5_balance_sheet_and_debt.sql',
  '027_stage6_customer_and_revenue_dimensions.sql',
].map((name) => readFileSync(join(process.cwd(), 'db/migrations', name), 'utf8'))

const migrationSql = migrations.join('\n')

const companyOwnedTables = [
  'financial_sync_runs',
  'financial_accounts',
  'financial_reporting_periods',
  'financial_statement_lines',
  'financial_transactions',
  'financial_transaction_lines',
  'financial_budgets',
  'financial_budget_lines',
  'financial_invoices',
  'financial_invoice_lines',
  'financial_invoice_payments',
  'financial_debts',
  'financial_debt_repayments',
  'financial_customers',
  'financial_revenue_dimensions',
  'financial_revenue_entries',
  'financial_revenue_entry_dimensions',
]

describe('Stage 3-6 company ownership migrations', () => {
  it.each(companyOwnedTables)('adds a required company boundary to %s', (table) => {
    const tableDefinition = migrationSql.match(
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`),
    )?.[1]

    expect(tableDefinition).toBeDefined()
    expect(tableDefinition).toContain(
      'company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT',
    )
  })

  it('uses company identifiers for provider-record deduplication', () => {
    expect(migrationSql).toContain('UNIQUE (company_id, source_type, provider_account_id)')
    expect(migrationSql).toContain(
      'UNIQUE (company_id, source_type, statement_type, period_start, period_end, currency)',
    )
    expect(migrationSql).toContain('UNIQUE (company_id, source_type, provider_transaction_id)')
    expect(migrationSql).toContain('UNIQUE (company_id, source_type, provider_invoice_id)')
    expect(migrationSql).toContain('UNIQUE (company_id, source_type, provider_debt_id)')
    expect(migrationSql).toContain('UNIQUE (company_id, source_type, provider_customer_id)')
    expect(migrationSql).not.toContain('UNIQUE (user_id, source_type')
  })

  it('restricts reads and mutations to the authenticated company administrator', () => {
    for (const migration of migrations) {
      expect(migration).toContain('company_id = public.current_company_id()')
      expect(migration).toContain("public.current_user_company_role() = ''admin''")
      expect(migration).toContain('user_id = auth.uid() AND company_id = public.current_company_id()')
      expect(migration).not.toContain(
        'FOR SELECT USING (auth.uid() = user_id)',
      )
    }
  })
})
