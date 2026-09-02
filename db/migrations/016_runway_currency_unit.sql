-- Treat runway as a unit-based metric throughout the document confirmation
-- trust boundary. The original extraction payload remains unchanged as audit
-- evidence, while reviewed candidates and published observations store no
-- currency for runway_months.

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
        OR (
          review.metric_key = 'runway_months'
          AND review.currency IS NOT NULL
        )
        OR (
          review.metric_key <> 'runway_months'
          AND (
            review.currency IS NULL
            OR UPPER(review.currency) NOT IN ('NZD', 'AUD')
          )
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
