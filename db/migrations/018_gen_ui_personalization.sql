-- Explicit company and user preferences used to personalise Gen UI selection.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS business_size TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companies_business_size_check'
      AND conrelid = 'public.companies'::regclass
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_business_size_check
      CHECK (
        business_size IS NULL
        OR business_size IN ('small', 'medium', 'large')
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_gen_ui_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  decision_role TEXT NOT NULL DEFAULT 'owner',
  priority_topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  detail_level TEXT NOT NULL DEFAULT 'balanced',
  planning_horizon INTEGER NOT NULL DEFAULT 6,
  learn_from_history BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_gen_ui_preferences_role_check
    CHECK (decision_role IN ('owner', 'finance', 'manager')),
  CONSTRAINT user_gen_ui_preferences_topics_check
    CHECK (
      priority_topics <@ ARRAY[
        'cash_runway',
        'growth',
        'cost_control',
        'collections',
        'forecasting',
        'profitability'
      ]::TEXT[]
      AND CARDINALITY(priority_topics) <= 3
    ),
  CONSTRAINT user_gen_ui_preferences_detail_check
    CHECK (detail_level IN ('quick', 'balanced', 'detailed')),
  CONSTRAINT user_gen_ui_preferences_horizon_check
    CHECK (planning_horizon IN (3, 6, 12))
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gen_ui_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view their company"
  ON public.companies;
CREATE POLICY "Company members can view their company"
  ON public.companies FOR SELECT
  USING (id = public.current_company_id());

DROP POLICY IF EXISTS "Users can view own Gen UI preferences"
  ON public.user_gen_ui_preferences;
CREATE POLICY "Users can view own Gen UI preferences"
  ON public.user_gen_ui_preferences FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own Gen UI preferences"
  ON public.user_gen_ui_preferences;
CREATE POLICY "Users can insert own Gen UI preferences"
  ON public.user_gen_ui_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own Gen UI preferences"
  ON public.user_gen_ui_preferences;
CREATE POLICY "Users can update own Gen UI preferences"
  ON public.user_gen_ui_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_gen_ui_preferences_updated_at
  ON public.user_gen_ui_preferences;
CREATE TRIGGER update_user_gen_ui_preferences_updated_at
  BEFORE UPDATE ON public.user_gen_ui_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
