-- Stage 7: user-owned manual dashboard layouts.
-- Financial values are never stored here. The payload contains only validated
-- widget choices and presentation controls; widgets are hydrated from trusted
-- financial records whenever a saved layout is opened.
CREATE TABLE IF NOT EXISTS public.user_dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  source_plan_version INTEGER,
  source_generated_at TIMESTAMP WITH TIME ZONE,
  layout_payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT user_dashboard_layouts_name_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT user_dashboard_layouts_source_version_check
    CHECK (source_plan_version IS NULL OR source_plan_version > 0),
  CONSTRAINT user_dashboard_layouts_payload_check
    CHECK (
      jsonb_typeof(layout_payload) = 'object'
      AND layout_payload ->> 'version' = '1'
      AND jsonb_typeof(layout_payload -> 'widgets') = 'array'
      AND jsonb_array_length(layout_payload -> 'widgets') <= 20
      AND jsonb_typeof(layout_payload -> 'riskThresholds') = 'object'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_dashboard_layouts_name
  ON public.user_dashboard_layouts (user_id, lower(btrim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_dashboard_layouts_one_default
  ON public.user_dashboard_layouts (user_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_user_dashboard_layouts_user_updated
  ON public.user_dashboard_layouts (user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.clear_other_user_dashboard_layout_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.user_dashboard_layouts
    SET is_default = FALSE
    WHERE user_id = NEW.user_id
      AND id <> NEW.id
      AND is_default;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_other_user_dashboard_layout_defaults
  ON public.user_dashboard_layouts;
CREATE TRIGGER clear_other_user_dashboard_layout_defaults
  BEFORE INSERT OR UPDATE OF is_default
  ON public.user_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_other_user_dashboard_layout_defaults();

ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dashboard layouts"
  ON public.user_dashboard_layouts;
CREATE POLICY "Users can view own dashboard layouts"
  ON public.user_dashboard_layouts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own dashboard layouts"
  ON public.user_dashboard_layouts;
CREATE POLICY "Users can insert own dashboard layouts"
  ON public.user_dashboard_layouts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own dashboard layouts"
  ON public.user_dashboard_layouts;
CREATE POLICY "Users can update own dashboard layouts"
  ON public.user_dashboard_layouts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own dashboard layouts"
  ON public.user_dashboard_layouts;
CREATE POLICY "Users can delete own dashboard layouts"
  ON public.user_dashboard_layouts FOR DELETE
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_user_dashboard_layouts_updated_at
  ON public.user_dashboard_layouts;
CREATE TRIGGER update_user_dashboard_layouts_updated_at
  BEFORE UPDATE ON public.user_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
