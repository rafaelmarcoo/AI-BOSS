-- Stores Xero OAuth connection details and short-lived OAuth state.
CREATE TABLE IF NOT EXISTS public.xero_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.xero_oauth_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (user_id),
  UNIQUE (state)
);

CREATE INDEX IF NOT EXISTS idx_xero_connections_user_id
  ON public.xero_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_xero_oauth_states_user_id
  ON public.xero_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_xero_oauth_states_created_at
  ON public.xero_oauth_states(created_at DESC);

ALTER TABLE public.xero_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Xero connection"
  ON public.xero_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Xero connection"
  ON public.xero_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Xero connection"
  ON public.xero_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Xero connection"
  ON public.xero_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own Xero OAuth state"
  ON public.xero_oauth_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Xero OAuth state"
  ON public.xero_oauth_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Xero OAuth state"
  ON public.xero_oauth_states FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Xero OAuth state"
  ON public.xero_oauth_states FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_xero_connections_updated_at
  BEFORE UPDATE ON public.xero_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
