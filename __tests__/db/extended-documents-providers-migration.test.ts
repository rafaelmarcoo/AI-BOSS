/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(process.cwd(), 'db/migrations/029_extended_documents_and_providers.sql'),
  'utf8'
)

describe('extended documents and providers migration', () => {
  it('allows every supported document format', () => {
    expect(migration).toContain(
      "CHECK (file_type IN ('pdf', 'csv', 'xlsx', 'image', 'text', 'docx'))"
    )
  })

  it('retains MYOB while adding Zoho Books and FreeAgent', () => {
    for (const provider of [
      'xero',
      'quickbooks',
      'freshbooks',
      'myob',
      'zoho_books',
      'freeagent',
    ]) {
      expect(migration).toContain(`'${provider}'`)
    }
  })

  it('updates OAuth, trusted observations, and every detailed provider source constraint', () => {
    for (const constraint of [
      'data_connections_provider_check',
      'oauth_connection_states_provider_check',
      'oauth_tokens_provider_check',
      'financial_metric_observations_source_type_check',
      'financial_sync_runs_provider_check',
      'financial_accounts_source_type_check',
      'financial_reporting_periods_source_type_check',
      'financial_transactions_source_type_check',
      'financial_budgets_source_type_check',
      'financial_invoices_source_type_check',
      'financial_debts_source_type_check',
      'financial_customers_source_type_check',
      'financial_revenue_dimensions_source_type_check',
      'financial_revenue_entries_source_type_check',
    ]) {
      expect(migration).toContain(`DROP CONSTRAINT IF EXISTS ${constraint}`)
      expect(migration).toContain(`ADD CONSTRAINT ${constraint}`)
    }
  })
})
