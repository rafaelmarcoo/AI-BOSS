-- Extend immutable financial-analysis snapshots with explicit timeline selection metadata.
ALTER TABLE public.financial_analysis_runs
  ADD COLUMN selection_mode TEXT,
  ADD COLUMN selected_sources JSONB,
  ADD COLUMN reporting_period_start DATE,
  ADD COLUMN reporting_period_end DATE;

-- Existing v1 reports represented one source. Preserve that meaning while
-- deriving their reporting window from the immutable evidence snapshot.
UPDATE public.financial_analysis_runs
SET
  selection_mode = 'single',
  selected_sources = JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
    'sourceKey', selected_source_key,
    'sourceLabel', selected_source_label
  )),
  reporting_period_start = COALESCE(
    (
      SELECT MIN((evidence_item ->> 'reportingDate')::DATE)
      FROM JSONB_ARRAY_ELEMENTS(
        COALESCE(result_payload -> 'evidence', '[]'::JSONB)
      ) AS evidence_item
      WHERE evidence_item ? 'reportingDate'
    ),
    created_at::DATE
  ),
  reporting_period_end = COALESCE(
    (
      SELECT MAX((evidence_item ->> 'reportingDate')::DATE)
      FROM JSONB_ARRAY_ELEMENTS(
        COALESCE(result_payload -> 'evidence', '[]'::JSONB)
      ) AS evidence_item
      WHERE evidence_item ? 'reportingDate'
    ),
    created_at::DATE
  )
WHERE selection_mode IS NULL;

ALTER TABLE public.financial_analysis_runs
  ALTER COLUMN selection_mode SET NOT NULL,
  ALTER COLUMN selected_sources SET NOT NULL,
  ALTER COLUMN reporting_period_start SET NOT NULL,
  ALTER COLUMN reporting_period_end SET NOT NULL,
  ADD CONSTRAINT financial_analysis_runs_selection_mode_check
    CHECK (selection_mode IN ('single', 'timeline')),
  ADD CONSTRAINT financial_analysis_runs_selected_sources_check
    CHECK (
      JSONB_TYPEOF(selected_sources) = 'array'
      AND (
        (selection_mode = 'single' AND JSONB_ARRAY_LENGTH(selected_sources) = 1)
        OR
        (selection_mode = 'timeline' AND JSONB_ARRAY_LENGTH(selected_sources) BETWEEN 2 AND 12)
      )
    ),
  ADD CONSTRAINT financial_analysis_runs_reporting_period_check
    CHECK (reporting_period_start <= reporting_period_end);
