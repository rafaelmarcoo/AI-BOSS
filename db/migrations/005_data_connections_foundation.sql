-- Provider-neutral registry for all financial data sources.
CREATE TABLE IF NOT EXISTS public.data_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  display_name TEXT NOT NULL,
  source_label TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE,
  disconnected_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT data_connections_provider_check
    CHECK (provider IN ('xero', 'csv', 'pdf', 'manual', 'demo')),
  CONSTRAINT data_connections_status_check
    CHECK (status IN ('connected', 'disconnected', 'available', 'error')),
  UNIQUE (user_id, provider)
);

-- Generic OAuth state table, reusable by any OAuth-backed data provider.
CREATE TABLE IF NOT EXISTS public.oauth_connection_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  state TEXT NOT NULL,
  redirect_path TEXT NOT NULL DEFAULT '/dashboard',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT oauth_connection_states_provider_check
    CHECK (provider IN ('xero', 'csv', 'pdf', 'manual', 'demo')),
  UNIQUE (user_id, provider),
  UNIQUE (state)
);

CREATE INDEX IF NOT EXISTS idx_data_connections_user_id
  ON public.data_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_data_connections_provider
  ON public.data_connections(provider);
CREATE INDEX IF NOT EXISTS idx_data_connections_status
  ON public.data_connections(status);
CREATE INDEX IF NOT EXISTS idx_oauth_connection_states_user_provider
  ON public.oauth_connection_states(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_connection_states_created_at
  ON public.oauth_connection_states(created_at DESC);

ALTER TABLE public.data_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_connection_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data connections"
  ON public.data_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data connections"
  ON public.data_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data connections"
  ON public.data_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data connections"
  ON public.data_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own OAuth connection states"
  ON public.oauth_connection_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OAuth connection states"
  ON public.oauth_connection_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own OAuth connection states"
  ON public.oauth_connection_states FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own OAuth connection states"
  ON public.oauth_connection_states FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_data_connections_updated_at
  BEFORE UPDATE ON public.data_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Backfill existing Xero credential rows into the provider-neutral registry.
INSERT INTO public.data_connections (
  user_id,
  provider,
  status,
  display_name,
  source_label,
  connected_at,
  metadata,
  created_at,
  updated_at
)
SELECT
  user_id,
  'xero',
  'connected',
  tenant_name,
  'Xero',
  connected_at,
  jsonb_build_object('tenantId', tenant_id),
  connected_at,
  updated_at
FROM public.xero_connections
ON CONFLICT (user_id, provider) DO UPDATE
SET
  status = 'connected',
  display_name = EXCLUDED.display_name,
  source_label = EXCLUDED.source_label,
  connected_at = EXCLUDED.connected_at,
  disconnected_at = NULL,
  error_message = NULL,
  metadata = EXCLUDED.metadata,
  updated_at = EXCLUDED.updated_at;

ALTER TABLE public.xero_connections
ADD COLUMN IF NOT EXISTS connection_id UUID;

UPDATE public.xero_connections xero
SET connection_id = data_connections.id
FROM public.data_connections
WHERE data_connections.user_id = xero.user_id
  AND data_connections.provider = 'xero'
  AND xero.connection_id IS NULL;

ALTER TABLE public.xero_connections
ALTER COLUMN connection_id SET NOT NULL;

ALTER TABLE public.xero_connections
ADD CONSTRAINT xero_connections_connection_fk
  FOREIGN KEY (connection_id)
  REFERENCES public.data_connections(id)
  ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_xero_connections_connection_id
  ON public.xero_connections(connection_id);

DROP TABLE IF EXISTS public.xero_oauth_states;
