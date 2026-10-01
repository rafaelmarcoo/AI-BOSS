-- Adds zoho_books as a valid accounting provider alongside xero/quickbooks/freshbooks/myob.

ALTER TABLE public.data_connections
  DROP CONSTRAINT IF EXISTS data_connections_provider_check,
  ADD CONSTRAINT data_connections_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'csv', 'pdf', 'manual', 'demo'));

ALTER TABLE public.oauth_connection_states
  DROP CONSTRAINT IF EXISTS oauth_connection_states_provider_check,
  ADD CONSTRAINT oauth_connection_states_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'csv', 'pdf', 'manual', 'demo'));

ALTER TABLE public.financial_metric_observations
  DROP CONSTRAINT IF EXISTS financial_metric_observations_source_type_check,
  ADD CONSTRAINT financial_metric_observations_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books', 'document', 'manual', 'demo'));

ALTER TABLE public.oauth_tokens
  DROP CONSTRAINT IF EXISTS oauth_tokens_provider_check,
  ADD CONSTRAINT oauth_tokens_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'zoho_books'));
