-- Company-owned financial truth with employee-to-admin document review.
-- user_id remains the uploader/creator audit identity; company_id is the
-- authorization and calculation boundary for trusted financial data.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.financial_metric_observations
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT;

UPDATE public.documents document
SET company_id = company.id
FROM public.users profile
JOIN public.companies company
  ON LOWER(TRIM(company.name)) = LOWER(TRIM(profile.company_name))
WHERE document.user_id = profile.id
  AND document.company_id IS NULL;

UPDATE public.financial_metric_observations observation
SET company_id = company.id
FROM public.users profile
JOIN public.companies company
  ON LOWER(TRIM(company.name)) = LOWER(TRIM(profile.company_name))
WHERE observation.user_id = profile.id
  AND observation.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_company_review_created
  ON public.documents(company_id, financial_review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_metric_observations_company_metric_updated
  ON public.financial_metric_observations(company_id, metric_key, updated_at DESC);

-- Migration 015 assumed the uploader was always the reviewer. Company review
-- allows a different same-company administrator and permits saved pending drafts.
ALTER TABLE public.document_extraction_candidates
  DROP CONSTRAINT IF EXISTS document_extraction_candidates_reviewer_check;

ALTER TABLE public.document_extraction_candidates
  DROP CONSTRAINT IF EXISTS document_extraction_candidates_review_state_check;

ALTER TABLE public.document_extraction_candidates
  ADD CONSTRAINT document_extraction_candidates_review_state_check
  CHECK (
    (
      decision = 'pending'
      AND (
        (reviewer_id IS NULL AND reviewed_at IS NULL)
        OR (reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL)
      )
    )
    OR
    (
      decision IN ('included', 'excluded')
      AND reviewer_id IS NOT NULL
      AND reviewed_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Owners and company admins can view documents"
  ON public.documents FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      company_id = public.current_company_id()
      AND public.current_user_company_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
CREATE POLICY "Users can insert company documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_company_id()
  );

-- Document state changes and deletion are performed only through server-side
-- services/RPCs so a browser client cannot bypass the admin approval boundary.
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

DROP POLICY IF EXISTS "Users can view own document extraction runs"
  ON public.document_extraction_runs;
CREATE POLICY "Owners and company admins can view document extraction runs"
  ON public.document_extraction_runs FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.documents document
      WHERE document.id = document_extraction_runs.document_id
        AND document.company_id = public.current_company_id()
        AND public.current_user_company_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own document extraction candidates"
  ON public.document_extraction_candidates;
CREATE POLICY "Owners and company admins can view document extraction candidates"
  ON public.document_extraction_candidates FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.documents document
      WHERE document.id = document_extraction_candidates.document_id
        AND document.company_id = public.current_company_id()
        AND public.current_user_company_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own financial metric observations"
  ON public.financial_metric_observations;
CREATE POLICY "Company admins can view company financial metric observations"
  ON public.financial_metric_observations FOR SELECT
  USING (
    (
      company_id = public.current_company_id()
      AND public.current_user_company_role() = 'admin'
    )
    OR (company_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own financial metric observations"
  ON public.financial_metric_observations;
CREATE POLICY "Company admins can insert company financial metric observations"
  ON public.financial_metric_observations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_company_id()
    AND public.current_user_company_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can update own financial metric observations"
  ON public.financial_metric_observations;
CREATE POLICY "Company admins can update company financial metric observations"
  ON public.financial_metric_observations FOR UPDATE
  USING (
    company_id = public.current_company_id()
    AND public.current_user_company_role() = 'admin'
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND public.current_user_company_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users can delete own financial metric observations"
  ON public.financial_metric_observations;
CREATE POLICY "Company admins can delete company financial metric observations"
  ON public.financial_metric_observations FOR DELETE
  USING (
    company_id = public.current_company_id()
    AND public.current_user_company_role() = 'admin'
  );

CREATE OR REPLACE FUNCTION public.save_document_extraction_review_draft(
  p_document_id UUID,
  p_user_id UUID,
  p_extraction_run_id UUID,
  p_reviewer_id UUID,
  p_reviewed_candidates JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_reviewer_company_id UUID;
  v_reviewer_role TEXT;
  v_run_status TEXT;
  v_candidate_count INTEGER;
  v_payload_count INTEGER;
  v_unique_payload_count INTEGER;
  v_reviewed_at TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  IF jsonb_typeof(p_reviewed_candidates) <> 'array' THEN
    RAISE EXCEPTION 'The reviewed candidate payload must be an array.';
  END IF;

  SELECT company_id
  INTO v_company_id
  FROM public.documents
  WHERE id = p_document_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found for this owner.';
  END IF;

  SELECT company.id, reviewer.user_type
  INTO v_reviewer_company_id, v_reviewer_role
  FROM public.users reviewer
  JOIN public.companies company
    ON LOWER(TRIM(company.name)) = LOWER(TRIM(reviewer.company_name))
  WHERE reviewer.id = p_reviewer_id
  LIMIT 1;

  IF p_reviewer_id <> p_user_id
     AND NOT (
       v_reviewer_role = 'admin'
       AND v_reviewer_company_id = v_company_id
     ) THEN
    RAISE EXCEPTION 'Only the uploader or a company administrator can save this review.';
  END IF;

  SELECT status
  INTO v_run_status
  FROM public.document_extraction_runs
  WHERE id = p_extraction_run_id
    AND document_id = p_document_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_run_status <> 'extracted' THEN
    RAISE EXCEPTION 'Only a completed extraction run can be edited.';
  END IF;

  SELECT COUNT(*)
  INTO v_candidate_count
  FROM public.document_extraction_candidates
  WHERE extraction_run_id = p_extraction_run_id
    AND document_id = p_document_id
    AND user_id = p_user_id;

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
    RAISE EXCEPTION 'Every candidate must be saved exactly once.';
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
      OR review.decision IS NULL
      OR review.decision NOT IN ('pending', 'included', 'excluded')
  ) THEN
    RAISE EXCEPTION 'The draft contains an invalid candidate or decision.';
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
  SET metric_key = review.metric_key,
      value = review.value,
      currency = CASE
        WHEN review.metric_key = 'runway_months' THEN NULL
        WHEN review.currency IS NULL THEN NULL
        ELSE UPPER(review.currency)
      END,
      reporting_date = review.reporting_date,
      reviewed_payload = jsonb_build_object(
        'metricKey', review.metric_key,
        'value', review.value,
        'currency', CASE
          WHEN review.metric_key = 'runway_months' THEN NULL
          WHEN review.currency IS NULL THEN NULL
          ELSE UPPER(review.currency)
        END,
        'reportingDate', review.reporting_date,
        'decision', review.decision,
        'draft', TRUE
      ),
      decision = review.decision,
      reviewer_id = p_reviewer_id,
      reviewed_at = v_reviewed_at
  FROM review
  WHERE candidate.id = review.candidate_id
    AND candidate.extraction_run_id = p_extraction_run_id
    AND candidate.document_id = p_document_id
    AND candidate.user_id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_document_extraction_review_draft(UUID, UUID, UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_document_extraction_review_draft(UUID, UUID, UUID, UUID, JSONB) TO service_role;

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
  v_company_id UUID;
  v_reviewer_company_id UUID;
  v_reviewer_role TEXT;
  v_run_status TEXT;
  v_candidate_count INTEGER;
  v_payload_count INTEGER;
  v_unique_payload_count INTEGER;
  v_inserted_count INTEGER := 0;
  v_reviewed_at TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  IF jsonb_typeof(p_reviewed_candidates) <> 'array' THEN
    RAISE EXCEPTION 'The reviewed candidate payload must be an array.';
  END IF;

  SELECT document.file_name, document.company_id
  INTO v_document_file_name, v_company_id
  FROM public.documents document
  WHERE document.id = p_document_id
    AND document.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found for this owner.';
  END IF;

  SELECT company.id, reviewer.user_type
  INTO v_reviewer_company_id, v_reviewer_role
  FROM public.users reviewer
  JOIN public.companies company
    ON LOWER(TRIM(company.name)) = LOWER(TRIM(reviewer.company_name))
  WHERE reviewer.id = p_reviewer_id
  LIMIT 1;

  IF v_reviewer_role IS DISTINCT FROM 'admin'
     OR v_reviewer_company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'Only an administrator from this company can confirm financial values.';
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
          'cash', 'accounts_receivable', 'accounts_payable',
          'monthly_revenue', 'monthly_expenses', 'burn_rate', 'runway_months'
        )
        OR review.value IS NULL
        OR (review.metric_key = 'runway_months' AND review.currency IS NOT NULL)
        OR (
          review.metric_key <> 'runway_months'
          AND (review.currency IS NULL OR UPPER(review.currency) NOT IN ('NZD', 'AUD'))
        )
        OR review.reporting_date IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Included candidates require a supported metric, value, reporting date, and NZD or AUD currency for monetary metrics; runway months must not have currency.';
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
      currency = CASE
        WHEN review.decision <> 'included' THEN candidate.currency
        WHEN review.metric_key = 'runway_months' THEN NULL
        ELSE UPPER(review.currency)
      END,
      reporting_date = CASE WHEN review.decision = 'included' THEN review.reporting_date ELSE candidate.reporting_date END,
      reviewed_payload = jsonb_build_object(
        'metricKey', review.metric_key,
        'value', review.value,
        'currency', CASE
          WHEN review.metric_key = 'runway_months' THEN NULL
          WHEN review.currency IS NULL THEN NULL
          ELSE UPPER(review.currency)
        END,
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
  SET status = 'superseded', superseded_at = v_reviewed_at
  WHERE document_id = p_document_id
    AND user_id = p_user_id
    AND status = 'confirmed'
    AND id <> p_extraction_run_id;

  DELETE FROM public.financial_metric_observations
  WHERE document_id = p_document_id;

  INSERT INTO public.financial_metric_observations (
    user_id, company_id, connection_id, document_id, metric_key, value,
    currency, period_start, period_end, as_of_date, source_type, source_label,
    confidence, evidence, raw_data
  )
  SELECT
    candidate.user_id, v_company_id, NULL, candidate.document_id,
    candidate.metric_key, candidate.value, candidate.currency, NULL, NULL,
    candidate.reporting_date, 'document', v_document_file_name,
    COALESCE(candidate.confidence, 1), candidate.evidence,
    jsonb_build_object(
      'trustLabel', 'User-confirmed',
      'reviewStatus', 'user_confirmed',
      'extractionRunId', candidate.extraction_run_id,
      'candidateId', candidate.id,
      'extractorVersion', candidate.extractor_version,
      'originalPayload', candidate.original_payload,
      'reviewedPayload', candidate.reviewed_payload,
      'uploaderId', candidate.user_id,
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

CREATE OR REPLACE FUNCTION public.delete_company_document_and_derived_metrics(
  p_document_id UUID,
  p_requester_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id UUID;
  v_company_id UUID;
  v_review_status TEXT;
  v_requester_company_id UUID;
  v_requester_role TEXT;
BEGIN
  SELECT user_id, company_id, financial_review_status
  INTO v_owner_id, v_company_id, v_review_status
  FROM public.documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found.';
  END IF;

  SELECT company.id, profile.user_type
  INTO v_requester_company_id, v_requester_role
  FROM public.users profile
  JOIN public.companies company
    ON LOWER(TRIM(company.name)) = LOWER(TRIM(profile.company_name))
  WHERE profile.id = p_requester_id
  LIMIT 1;

  IF NOT (
    (v_owner_id = p_requester_id AND v_review_status <> 'confirmed')
    OR (
      v_requester_role = 'admin'
      AND v_requester_company_id = v_company_id
    )
  ) THEN
    RAISE EXCEPTION 'You are not allowed to delete this document.';
  END IF;

  DELETE FROM public.financial_metric_observations
  WHERE document_id = p_document_id;

  DELETE FROM public.documents
  WHERE id = p_document_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_company_document_and_derived_metrics(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_company_document_and_derived_metrics(UUID, UUID) TO service_role;
