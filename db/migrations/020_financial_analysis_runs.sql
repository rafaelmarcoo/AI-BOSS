-- Immutable owner-private financial analysis snapshots and append-only decision tests.
CREATE TABLE IF NOT EXISTS public.financial_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  selected_source_key TEXT NOT NULL,
  selected_source_label TEXT NOT NULL,
  selected_currency TEXT NOT NULL,
  run_status TEXT NOT NULL,
  data_readiness TEXT NOT NULL,
  baseline_fingerprint JSONB NOT NULL,
  result_payload JSONB NOT NULL,
  agent_trace JSONB NOT NULL,
  policy_version TEXT NOT NULL,
  model_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  token_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_analysis_runs_owner_identity_unique
    UNIQUE (id, user_id),
  CONSTRAINT financial_analysis_runs_source_key_check
    CHECK (CHAR_LENGTH(BTRIM(selected_source_key)) > 0),
  CONSTRAINT financial_analysis_runs_source_label_check
    CHECK (CHAR_LENGTH(BTRIM(selected_source_label)) > 0),
  CONSTRAINT financial_analysis_runs_currency_check
    CHECK (selected_currency IN ('NZD', 'AUD')),
  CONSTRAINT financial_analysis_runs_status_check
    CHECK (run_status IN ('complete', 'completed_with_fallback')),
  CONSTRAINT financial_analysis_runs_readiness_check
    CHECK (data_readiness IN ('ready', 'limited', 'action_required')),
  CONSTRAINT financial_analysis_runs_fingerprint_check
    CHECK (JSONB_TYPEOF(baseline_fingerprint) = 'array'),
  CONSTRAINT financial_analysis_runs_result_check
    CHECK (
      JSONB_TYPEOF(result_payload) = 'object'
      AND result_payload ? 'version'
    ),
  CONSTRAINT financial_analysis_runs_agent_trace_check
    CHECK (JSONB_TYPEOF(agent_trace) = 'object'),
  CONSTRAINT financial_analysis_runs_policy_version_check
    CHECK (CHAR_LENGTH(BTRIM(policy_version)) > 0),
  CONSTRAINT financial_analysis_runs_model_metadata_check
    CHECK (JSONB_TYPEOF(model_metadata) = 'object'),
  CONSTRAINT financial_analysis_runs_token_metadata_check
    CHECK (JSONB_TYPEOF(token_metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.financial_decision_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  normalized_input JSONB NOT NULL,
  scenario_result JSONB NOT NULL,
  policy_result JSONB NOT NULL,
  outcome TEXT NOT NULL,
  override_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_decision_tests_analysis_owner_fk
    FOREIGN KEY (analysis_run_id, user_id)
    REFERENCES public.financial_analysis_runs(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT financial_decision_tests_input_check
    CHECK (JSONB_TYPEOF(normalized_input) = 'object'),
  CONSTRAINT financial_decision_tests_scenario_result_check
    CHECK (JSONB_TYPEOF(scenario_result) = 'object'),
  CONSTRAINT financial_decision_tests_policy_result_check
    CHECK (JSONB_TYPEOF(policy_result) = 'object'),
  CONSTRAINT financial_decision_tests_outcome_check
    CHECK (outcome IN ('allowed', 'blocked', 'overridden')),
  CONSTRAINT financial_decision_tests_override_reason_check
    CHECK (
      (
        outcome = 'overridden'
        AND override_reason IS NOT NULL
        AND CHAR_LENGTH(BTRIM(override_reason)) BETWEEN 10 AND 500
      )
      OR (
        outcome <> 'overridden'
        AND override_reason IS NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_financial_analysis_runs_owner_created
  ON public.financial_analysis_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_decision_tests_owner_created
  ON public.financial_decision_tests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_decision_tests_analysis_created
  ON public.financial_decision_tests(analysis_run_id, created_at ASC);

ALTER TABLE public.financial_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_decision_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own financial analysis runs"
  ON public.financial_analysis_runs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can insert own financial analysis runs"
  ON public.financial_analysis_runs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can view own financial decision tests"
  ON public.financial_decision_tests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owners can insert own financial decision tests"
  ON public.financial_decision_tests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Browser clients may append and read their own records, but cannot rewrite or
-- delete financial analysis audit history after it is created.
REVOKE ALL ON TABLE public.financial_analysis_runs FROM anon;
REVOKE ALL ON TABLE public.financial_decision_tests FROM anon;
REVOKE UPDATE, DELETE ON TABLE public.financial_analysis_runs FROM authenticated;
REVOKE UPDATE, DELETE ON TABLE public.financial_decision_tests FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.financial_analysis_runs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.financial_decision_tests TO authenticated;
