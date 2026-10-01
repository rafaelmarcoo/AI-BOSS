-- Removes myob as a valid accounting provider — its adapter and OAuth setup
-- were dropped in favor of the faster-to-set-up providers (Zoho Books,
-- FreeAgent). No connections were ever made for it, so this is a pure
-- constraint tightening with no data migration needed.

ALTER TABLE public.data_connections
  DROP CONSTRAINT IF EXISTS data_connections_provider_check,
  ADD CONSTRAINT data_connections_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'zoho_books', 'freeagent', 'csv', 'pdf', 'manual', 'demo'));

ALTER TABLE public.oauth_connection_states
  DROP CONSTRAINT IF EXISTS oauth_connection_states_provider_check,
  ADD CONSTRAINT oauth_connection_states_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'zoho_books', 'freeagent', 'csv', 'pdf', 'manual', 'demo'));

ALTER TABLE public.financial_metric_observations
  DROP CONSTRAINT IF EXISTS financial_metric_observations_source_type_check,
  ADD CONSTRAINT financial_metric_observations_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'zoho_books', 'freeagent', 'document', 'manual', 'demo'));

ALTER TABLE public.oauth_tokens
  DROP CONSTRAINT IF EXISTS oauth_tokens_provider_check,
  ADD CONSTRAINT oauth_tokens_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'zoho_books', 'freeagent'));
