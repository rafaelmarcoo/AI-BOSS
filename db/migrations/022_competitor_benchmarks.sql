-- Competitor figures, kept for side-by-side comparison with the user's own
-- company.
--
-- Competitor numbers live in their own tables on purpose. Every existing read
-- path (runway, snapshot, history, forecast, scenarios, ratios) treats
-- financial_metric_observations as the user's OWN company, so a competitor row
-- stored there would feed its cash into the user's runway. Separate tables make
-- that mistake impossible rather than merely unlikely.
--
-- Metric keys match financial_metric_observations so the same ratio
-- calculations apply to both companies. Currency is looser than for the user's
-- own figures because the CIMA case studies use fictional currencies such as
-- L$ and D$. Ratios do not depend on currency; amounts are only compared when
-- both companies report in the same currency.

CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT competitors_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT competitors_industry_check
    CHECK (industry IS NULL OR char_length(btrim(industry)) BETWEEN 1 AND 120),
  -- Lets observations reference (id, user_id) together, so the database itself
  -- rejects figures attached to another user's competitor.
  CONSTRAINT competitors_id_user_unique UNIQUE (id, user_id)
);

-- One competitor per name per user, ignoring case and surrounding spaces, so
-- "Fixxupp" and " fixxupp " are the same company.
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitors_user_name
  ON public.competitors(user_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.competitor_metric_observations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  competitor_id UUID NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC(18, 4) NOT NULL,
  currency TEXT,
  period_start DATE,
  period_end DATE,
  as_of_date DATE,
  source_label TEXT NOT NULL,
  evidence JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT competitor_metric_observations_competitor_owner_fkey
    FOREIGN KEY (competitor_id, user_id)
    REFERENCES public.competitors(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT competitor_metric_observations_metric_key_check
    CHECK (
      metric_key IN (
        'cash',
        'accounts_receivable',
        'accounts_payable',
        'monthly_revenue',
        'monthly_expenses',
        'burn_rate',
        'runway_months',
        'cost_of_sales',
        'operating_profit',
        'current_assets',
        'current_liabilities',
        'total_debt',
        'total_equity'
      )
    ),
  -- ISO codes such as NZD, or the CIMA case-study currencies such as L$ and D$.
  CONSTRAINT competitor_metric_observations_currency_check
    CHECK (currency IS NULL OR currency ~ '^[A-Z]{1,3}\$?$'),
  CONSTRAINT competitor_metric_observations_period_check
    CHECK (
      period_start IS NULL
      OR period_end IS NULL
      OR period_start <= period_end
    )
);

CREATE INDEX IF NOT EXISTS idx_competitor_metric_observations_competitor_metric
  ON public.competitor_metric_observations(competitor_id, metric_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_metric_observations_user
  ON public.competitor_metric_observations(user_id);

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_metric_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own competitors"
  ON public.competitors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own competitors"
  ON public.competitors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own competitors"
  ON public.competitors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own competitors"
  ON public.competitors FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own competitor metric observations"
  ON public.competitor_metric_observations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own competitor metric observations"
  ON public.competitor_metric_observations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own competitor metric observations"
  ON public.competitor_metric_observations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own competitor metric observations"
  ON public.competitor_metric_observations FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON public.competitors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitor_metric_observations_updated_at
  BEFORE UPDATE ON public.competitor_metric_observations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
