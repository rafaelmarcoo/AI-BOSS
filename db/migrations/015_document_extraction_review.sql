-- Reviewed document extraction trust boundary.
--
-- Existing document-derived observations remain calculation truth and are
-- classified as legacy. New extraction attempts write review candidates first;
-- only the confirmation function below may publish user-confirmed observations.

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_file_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_file_type_check
    CHECK (file_type IN ('pdf', 'csv', 'xlsx'));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS financial_review_status TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_financial_review_status_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_financial_review_status_check
    CHECK (financial_review_status IN ('legacy', 'not_required', 'pending', 'confirmed'));

COMMENT ON COLUMN public.documents.financial_review_status IS
  'Financial trust state, separate from file processing status. Existing documents are legacy until reprocessed and explicitly reviewed.';

CREATE TABLE IF NOT EXISTS public.document_extraction_runs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  selected_worksheet_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  suggested_worksheet_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  worksheet_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  extractor_version TEXT NOT NULL,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  superseded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT document_extraction_runs_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES public.documents(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT document_extraction_runs_status_check
    CHECK (status IN ('processing', 'extracted', 'failed', 'confirmed', 'superseded')),
  CONSTRAINT document_extraction_runs_worksheet_metadata_check
    CHECK (jsonb_typeof(worksheet_metadata) = 'array'),
  CONSTRAINT document_extraction_runs_warnings_check
    CHECK (jsonb_typeof(warnings) = 'array'),
  CONSTRAINT document_extraction_runs_status_timestamps_check
    CHECK (
      (status <> 'confirmed' OR confirmed_at IS NOT NULL)
      AND (status <> 'superseded' OR superseded_at IS NOT NULL)
    ),
  UNIQUE (id, document_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.document_extraction_candidates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  extraction_run_id UUID NOT NULL,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  original_payload JSONB NOT NULL,
  reviewed_payload JSONB,
  metric_key TEXT,
  value NUMERIC(18, 4),
  currency TEXT,
  reporting_date DATE,
  confidence NUMERIC(4, 3),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision TEXT NOT NULL DEFAULT 'pending',
  extractor_version TEXT NOT NULL,
  reviewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT document_extraction_candidates_run_fk
    FOREIGN KEY (extraction_run_id, document_id, user_id)
    REFERENCES public.document_extraction_runs(id, document_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT document_extraction_candidates_original_payload_check
    CHECK (jsonb_typeof(original_payload) = 'object'),
  CONSTRAINT document_extraction_candidates_reviewed_payload_check
    CHECK (reviewed_payload IS NULL OR jsonb_typeof(reviewed_payload) = 'object'),
  CONSTRAINT document_extraction_candidates_metric_key_check
    CHECK (
      metric_key IS NULL
      OR metric_key IN (
        'cash',
        'accounts_receivable',
        'accounts_payable',
        'monthly_revenue',
        'monthly_expenses',
        'burn_rate',
        'runway_months'
      )
    ),
  CONSTRAINT document_extraction_candidates_currency_check
    CHECK (currency IS NULL OR currency IN ('NZD', 'AUD')),
  CONSTRAINT document_extraction_candidates_confidence_check
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT document_extraction_candidates_evidence_check
    CHECK (jsonb_typeof(evidence) = 'object'),
  CONSTRAINT document_extraction_candidates_warnings_check
    CHECK (jsonb_typeof(warnings) = 'array'),
  CONSTRAINT document_extraction_candidates_decision_check
    CHECK (decision IN ('pending', 'included', 'excluded')),
  CONSTRAINT document_extraction_candidates_reviewer_check
    CHECK (reviewer_id IS NULL OR reviewer_id = user_id),
  CONSTRAINT document_extraction_candidates_review_state_check
    CHECK (
      (decision = 'pending' AND reviewer_id IS NULL AND reviewed_at IS NULL)
      OR
      (decision IN ('included', 'excluded') AND reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_documents_financial_review_status
  ON public.documents(user_id, financial_review_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_extraction_runs_document_created
  ON public.document_extraction_runs(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_extraction_runs_owner_status
  ON public.document_extraction_runs(user_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_extraction_runs_active_confirmation
  ON public.document_extraction_runs(document_id)
  WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_run_decision
  ON public.document_extraction_candidates(extraction_run_id, decision);
CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_owner_document
  ON public.document_extraction_candidates(user_id, document_id);

ALTER TABLE public.document_extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extraction_candidates ENABLE ROW LEVEL SECURITY;

-- Owners may inspect extraction evidence directly. Mutations are intentionally
-- server-only so clients cannot rewrite immutable extraction or review evidence.
CREATE POLICY "Users can view own document extraction runs"
  ON public.document_extraction_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own document extraction candidates"
  ON public.document_extraction_candidates FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER update_document_extraction_runs_updated_at
  BEFORE UPDATE ON public.document_extraction_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_extraction_candidates_updated_at
  BEFORE UPDATE ON public.document_extraction_candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Applies the complete review payload and publishes calculation truth in one
-- database transaction. Any validation or write failure rolls back candidate
-- corrections, decisions, observation replacement, and review status changes.
CREATE OR REPLACE FUNCTION public.confirm_document_extraction(
  p_document_id UUID,
  p_user_id UUID,
  p_extraction_run_id UUID,
  p_reviewer_id UUID,
  p_reviewed_candidates JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document_file_name TEXT;
  v_run_status TEXT;
  v_candidate_count INTEGER;
  v_payload_count INTEGER;
  v_unique_payload_count INTEGER;
  v_inserted_count INTEGER := 0;
  v_reviewed_at TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  IF p_reviewer_id <> p_user_id THEN
    RAISE EXCEPTION 'The reviewer must be the document owner.';
  END IF;

  IF jsonb_typeof(p_reviewed_candidates) <> 'array' THEN
    RAISE EXCEPTION 'The reviewed candidate payload must be an array.';
  END IF;

  SELECT file_name
  INTO v_document_file_name
  FROM public.documents
  WHERE id = p_document_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found for this owner.';
  END IF;

  SELECT status
  INTO v_run_status
  FROM public.document_extraction_runs
  WHERE id = p_extraction_run_id
    AND document_id = p_document_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extraction run not found for this document owner.';
  END IF;

  IF v_run_status <> 'extracted' THEN
    RAISE EXCEPTION 'Only a completed extraction run can be confirmed.';
  END IF;

  SELECT COUNT(*)
  INTO v_candidate_count
  FROM public.document_extraction_candidates
  WHERE extraction_run_id = p_extraction_run_id
    AND document_id = p_document_id
    AND user_id = p_user_id;

  IF v_candidate_count = 0 THEN
    RAISE EXCEPTION 'This extraction run has no candidates to review.';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT candidate_id)
  INTO v_payload_count, v_unique_payload_count
  FROM jsonb_to_recordset(p_reviewed_candidates) AS review(
    candidate_id UUID,
    decision TEXT,
    metric_key TEXT,
    value NUMERIC,
    currency TEXT,
    reporting_date DATE
  );

  IF v_payload_count <> v_candidate_count OR v_unique_payload_count <> v_candidate_count THEN
    RAISE EXCEPTION 'Every candidate must be reviewed exactly once.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_reviewed_candidates) AS review(
      candidate_id UUID,
      decision TEXT,
      metric_key TEXT,
      value NUMERIC,
      currency TEXT,
      reporting_date DATE
    )
    LEFT JOIN public.document_extraction_candidates candidate
      ON candidate.id = review.candidate_id
      AND candidate.extraction_run_id = p_extraction_run_id
      AND candidate.document_id = p_document_id
      AND candidate.user_id = p_user_id
    WHERE candidate.id IS NULL
  ) THEN
    RAISE EXCEPTION 'The review contains a candidate outside this extraction run.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_reviewed_candidates) AS review(
      candidate_id UUID,
      decision TEXT,
      metric_key TEXT,
      value NUMERIC,
      currency TEXT,
      reporting_date DATE
    )
    WHERE review.decision NOT IN ('included', 'excluded')
       OR review.decision IS NULL
  ) THEN
    RAISE EXCEPTION 'Every candidate decision must be included or excluded.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_reviewed_candidates) AS review(
      candidate_id UUID,
      decision TEXT,
      metric_key TEXT,
      value NUMERIC,
      currency TEXT,
      reporting_date DATE
    )
    WHERE review.decision = 'included'
      AND (
        review.metric_key IS NULL
        OR review.metric_key NOT IN (
          'cash',
          'accounts_receivable',
          'accounts_payable',
          'monthly_revenue',
          'monthly_expenses',
          'burn_rate',
          'runway_months'
        )
        OR review.value IS NULL
        OR UPPER(review.currency) NOT IN ('NZD', 'AUD')
        OR review.currency IS NULL
        OR review.reporting_date IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Included candidates require a supported metric, value, NZD or AUD currency, and reporting date.';
  END IF;

  WITH review AS (
    SELECT *
    FROM jsonb_to_recordset(p_reviewed_candidates) AS item(
      candidate_id UUID,
      decision TEXT,
      metric_key TEXT,
      value NUMERIC,
      currency TEXT,
      reporting_date DATE
    )
  )
  UPDATE public.document_extraction_candidates AS candidate
  SET metric_key = CASE WHEN review.decision = 'included' THEN review.metric_key ELSE candidate.metric_key END,
      value = CASE WHEN review.decision = 'included' THEN review.value ELSE candidate.value END,
      currency = CASE WHEN review.decision = 'included' THEN UPPER(review.currency) ELSE candidate.currency END,
      reporting_date = CASE WHEN review.decision = 'included' THEN review.reporting_date ELSE candidate.reporting_date END,
      reviewed_payload = jsonb_build_object(
        'metricKey', review.metric_key,
        'value', review.value,
        'currency', CASE WHEN review.currency IS NULL THEN NULL ELSE UPPER(review.currency) END,
        'reportingDate', review.reporting_date,
        'decision', review.decision
      ),
      decision = review.decision,
      reviewer_id = p_reviewer_id,
      reviewed_at = v_reviewed_at
  FROM review
  WHERE candidate.id = review.candidate_id
    AND candidate.extraction_run_id = p_extraction_run_id
    AND candidate.document_id = p_document_id
    AND candidate.user_id = p_user_id;

  UPDATE public.document_extraction_runs
  SET status = 'superseded',
      superseded_at = v_reviewed_at
  WHERE document_id = p_document_id
    AND user_id = p_user_id
    AND status = 'confirmed'
    AND id <> p_extraction_run_id;

  DELETE FROM public.financial_metric_observations
  WHERE document_id = p_document_id
    AND user_id = p_user_id;

  INSERT INTO public.financial_metric_observations (
    user_id,
    connection_id,
    document_id,
    metric_key,
    value,
    currency,
    period_start,
    period_end,
    as_of_date,
    source_type,
    source_label,
    confidence,
    evidence,
    raw_data
  )
  SELECT
    candidate.user_id,
    NULL,
    candidate.document_id,
    candidate.metric_key,
    candidate.value,
    candidate.currency,
    NULL,
    NULL,
    candidate.reporting_date,
    'document',
    v_document_file_name,
    COALESCE(candidate.confidence, 1),
    candidate.evidence,
    jsonb_build_object(
      'trustLabel', 'User-confirmed',
      'reviewStatus', 'user_confirmed',
      'extractionRunId', candidate.extraction_run_id,
      'candidateId', candidate.id,
      'extractorVersion', candidate.extractor_version,
      'originalPayload', candidate.original_payload,
      'reviewedPayload', candidate.reviewed_payload,
      'reviewerId', candidate.reviewer_id,
      'reviewedAt', candidate.reviewed_at
    )
  FROM public.document_extraction_candidates AS candidate
  WHERE candidate.extraction_run_id = p_extraction_run_id
    AND candidate.document_id = p_document_id
    AND candidate.user_id = p_user_id
    AND candidate.decision = 'included';

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  UPDATE public.document_extraction_runs
  SET status = 'confirmed',
      confirmed_at = v_reviewed_at,
      completed_at = COALESCE(completed_at, v_reviewed_at),
      error_message = NULL
  WHERE id = p_extraction_run_id
    AND document_id = p_document_id
    AND user_id = p_user_id;

  UPDATE public.documents
  SET financial_review_status = 'confirmed'
  WHERE id = p_document_id
    AND user_id = p_user_id;

  RETURN v_inserted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_document_extraction(UUID, UUID, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_document_extraction(UUID, UUID, UUID, UUID, JSONB) TO service_role;
