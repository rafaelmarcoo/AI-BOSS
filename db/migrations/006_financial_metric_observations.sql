-- Source-aware financial metric observations.
-- Each row represents one normalized metric value from Xero, an uploaded
-- document, manual input, or demo data.
CREATE TABLE IF NOT EXISTS public.financial_metric_observations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES public.data_connections(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC(18, 4) NOT NULL,
  currency TEXT,
  period_start DATE,
  period_end DATE,
  as_of_date DATE,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  confidence NUMERIC(4, 3) DEFAULT 1 NOT NULL,
  evidence JSONB DEFAULT '{}'::jsonb NOT NULL,
  raw_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT financial_metric_observations_metric_key_check
    CHECK (
      metric_key IN (
        'cash',
        'accounts_receivable',
        'accounts_payable',
        'monthly_revenue',
        'monthly_expenses',
        'burn_rate',
        'runway_months'
      )
    ),
  CONSTRAINT financial_metric_observations_source_type_check
    CHECK (source_type IN ('xero', 'document', 'manual', 'demo')),
  CONSTRAINT financial_metric_observations_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT financial_metric_observations_currency_check
    CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CONSTRAINT financial_metric_observations_period_check
    CHECK (
      period_start IS NULL
      OR period_end IS NULL
      OR period_start <= period_end
    )
);

CREATE INDEX IF NOT EXISTS idx_financial_metric_observations_user_metric_updated
  ON public.financial_metric_observations(user_id, metric_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_metric_observations_user_source
  ON public.financial_metric_observations(user_id, source_type);
CREATE INDEX IF NOT EXISTS idx_financial_metric_observations_connection_id
  ON public.financial_metric_observations(connection_id);
CREATE INDEX IF NOT EXISTS idx_financial_metric_observations_document_id
  ON public.financial_metric_observations(document_id);
CREATE INDEX IF NOT EXISTS idx_financial_metric_observations_as_of_date
  ON public.financial_metric_observations(as_of_date DESC);

ALTER TABLE public.financial_metric_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own financial metric observations"
  ON public.financial_metric_observations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own financial metric observations"
  ON public.financial_metric_observations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own financial metric observations"
  ON public.financial_metric_observations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own financial metric observations"
  ON public.financial_metric_observations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_financial_metric_observations_updated_at
  BEFORE UPDATE ON public.financial_metric_observations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
