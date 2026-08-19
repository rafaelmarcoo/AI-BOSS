-- Saved, explicitly shareable scenario drafts and latest calculated results.
CREATE TABLE IF NOT EXISTS public.scenarios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB,
  baseline_fingerprint JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT scenarios_name_check CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 80),
  CONSTRAINT scenarios_description_check CHECK (description IS NULL OR CHAR_LENGTH(description) <= 500),
  CONSTRAINT scenarios_status_check CHECK (status IN ('draft', 'calculated')),
  CONSTRAINT scenarios_visibility_check CHECK (visibility IN ('private', 'company')),
  CONSTRAINT scenarios_calculated_result_check CHECK (
    (status = 'draft' AND visibility = 'private')
    OR
    (status = 'calculated' AND result_payload IS NOT NULL AND calculated_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_scenarios_owner_updated
  ON public.scenarios(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenarios_company_visibility_updated
  ON public.scenarios(company_id, visibility, updated_at DESC);

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and company members can view scenarios"
  ON public.scenarios FOR SELECT
  USING (
    user_id = auth.uid()
    OR (visibility = 'company' AND company_id = public.current_company_id())
  );

CREATE POLICY "Users can insert own scenarios"
  ON public.scenarios FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_company_id()
    AND (visibility = 'private' OR status = 'calculated')
  );

CREATE POLICY "Owners can update scenarios"
  ON public.scenarios FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_company_id()
    AND (visibility = 'private' OR status = 'calculated')
  );

CREATE POLICY "Owners can delete scenarios"
  ON public.scenarios FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER update_scenarios_updated_at
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

