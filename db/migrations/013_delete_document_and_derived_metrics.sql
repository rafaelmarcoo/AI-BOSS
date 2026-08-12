-- A document can be the deterministic source for financial observations.
-- Delete those observations before the document row so its ON DELETE SET NULL
-- foreign key does not leave historical/dashboard values behind.
CREATE OR REPLACE FUNCTION public.delete_owned_document_and_derived_metrics(
  p_document_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.documents
    WHERE id = p_document_id AND user_id = p_user_id
  ) THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.financial_metric_observations
  WHERE document_id = p_document_id AND user_id = p_user_id;

  -- document_chunks are removed by the document foreign-key cascade.
  DELETE FROM public.documents
  WHERE id = p_document_id AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_owned_document_and_derived_metrics(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_owned_document_and_derived_metrics(UUID, UUID) TO service_role;
