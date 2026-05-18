-- Extend provider CHECK constraints to include new accounting providers.
-- PostgreSQL does not support ALTER CONSTRAINT directly — drop and recreate.

ALTER TABLE public.data_connections
  DROP CONSTRAINT IF EXISTS data_connections_provider_check,
  ADD CONSTRAINT data_connections_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'csv', 'pdf', 'manual', 'demo'));

ALTER TABLE public.oauth_connection_states
  DROP CONSTRAINT IF EXISTS oauth_connection_states_provider_check,
  ADD CONSTRAINT oauth_connection_states_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'csv', 'pdf', 'manual', 'demo'));

ALTER TABLE public.financial_metric_observations
  DROP CONSTRAINT IF EXISTS financial_metric_observations_source_type_check,
  ADD CONSTRAINT financial_metric_observations_source_type_check
    CHECK (source_type IN ('xero', 'quickbooks', 'freshbooks', 'myob', 'document', 'manual', 'demo'));

-- Single table for all OAuth provider tokens.
-- Replaces the per-provider xero_connections pattern with a provider-agnostic equivalent.
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.data_connections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT oauth_tokens_provider_check
    CHECK (provider IN ('xero', 'quickbooks', 'freshbooks', 'myob')),
  UNIQUE (user_id, provider),
  UNIQUE (connection_id)
);

-- Migrate existing Xero tokens from xero_connections into oauth_tokens.
INSERT INTO public.oauth_tokens (
  connection_id,
  user_id,
  provider,
  tenant_id,
  tenant_name,
  access_token_enc,
  refresh_token_enc,
  expires_at,
  connected_at,
  updated_at
)
SELECT
  xc.connection_id,
  xc.user_id,
  'xero',
  xc.tenant_id,
  xc.tenant_name,
  xc.access_token_enc,
  xc.refresh_token_enc,
  xc.expires_at,
  xc.connected_at,
  xc.updated_at
FROM public.xero_connections xc
WHERE xc.connection_id IS NOT NULL
ON CONFLICT (user_id, provider) DO UPDATE
SET
  access_token_enc = EXCLUDED.access_token_enc,
  refresh_token_enc = EXCLUDED.refresh_token_enc,
  expires_at = EXCLUDED.expires_at,
  updated_at = EXCLUDED.updated_at;

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider
  ON public.oauth_tokens(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_connection_id
  ON public.oauth_tokens(connection_id);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OAuth tokens"
  ON public.oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OAuth tokens"
  ON public.oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own OAuth tokens"
  ON public.oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own OAuth tokens"
  ON public.oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
