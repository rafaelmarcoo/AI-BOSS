-- Extend document ingestion and accounting-provider enums without weakening
-- the existing company/review boundaries. This migration changes allowed
-- values only; it does not publish document candidates as trusted metrics.

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_file_type_check,
  ADD CONSTRAINT documents_file_type_check
    CHECK (file_type IN ('pdf', 'csv', 'xlsx', 'image', 'text', 'docx'));

ALTER TABLE public.data_connections
  DROP CONSTRAINT IF EXISTS data_connections_provider_check,
  ADD CONSTRAINT data_connections_provider_check
    CHECK (provider IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'csv', 'pdf', 'xlsx', 'image', 'text', 'docx', 'manual', 'demo'
    ));

ALTER TABLE public.oauth_connection_states
  DROP CONSTRAINT IF EXISTS oauth_connection_states_provider_check,
  ADD CONSTRAINT oauth_connection_states_provider_check
    CHECK (provider IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'csv', 'pdf', 'xlsx', 'image', 'text', 'docx', 'manual', 'demo'
    ));

ALTER TABLE public.oauth_tokens
  DROP CONSTRAINT IF EXISTS oauth_tokens_provider_check,
  ADD CONSTRAINT oauth_tokens_provider_check
    CHECK (provider IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent'
    ));

ALTER TABLE public.financial_metric_observations
  DROP CONSTRAINT IF EXISTS financial_metric_observations_source_type_check,
  ADD CONSTRAINT financial_metric_observations_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_sync_runs
  DROP CONSTRAINT IF EXISTS financial_sync_runs_provider_check,
  ADD CONSTRAINT financial_sync_runs_provider_check
    CHECK (provider IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent'
    ));

ALTER TABLE public.financial_accounts
  DROP CONSTRAINT IF EXISTS financial_accounts_source_type_check,
  ADD CONSTRAINT financial_accounts_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_reporting_periods
  DROP CONSTRAINT IF EXISTS financial_reporting_periods_source_type_check,
  ADD CONSTRAINT financial_reporting_periods_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_source_type_check,
  ADD CONSTRAINT financial_transactions_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_budgets
  DROP CONSTRAINT IF EXISTS financial_budgets_source_type_check,
  ADD CONSTRAINT financial_budgets_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_invoices
  DROP CONSTRAINT IF EXISTS financial_invoices_source_type_check,
  ADD CONSTRAINT financial_invoices_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_debts
  DROP CONSTRAINT IF EXISTS financial_debts_source_type_check,
  ADD CONSTRAINT financial_debts_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_customers
  DROP CONSTRAINT IF EXISTS financial_customers_source_type_check,
  ADD CONSTRAINT financial_customers_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_revenue_dimensions
  DROP CONSTRAINT IF EXISTS financial_revenue_dimensions_source_type_check,
  ADD CONSTRAINT financial_revenue_dimensions_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));

ALTER TABLE public.financial_revenue_entries
  DROP CONSTRAINT IF EXISTS financial_revenue_entries_source_type_check,
  ADD CONSTRAINT financial_revenue_entries_source_type_check
    CHECK (source_type IN (
      'xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'freeagent',
      'document', 'manual', 'demo'
    ));
