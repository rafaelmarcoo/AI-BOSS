-- Store one server-only employee join code per company and rotate it daily.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.company_join_codes (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  join_code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.company_join_codes ENABLE ROW LEVEL SECURITY;

-- Join codes are only read by server code using the service role. The settings
-- loader separately verifies that the requester is a company admin.
REVOKE ALL ON TABLE public.company_join_codes FROM anon, authenticated;
GRANT ALL ON TABLE public.company_join_codes TO service_role;

CREATE OR REPLACE FUNCTION public.generate_company_join_code()
RETURNS TEXT
LANGUAGE SQL
VOLATILE
SET search_path = ''
AS $$
  SELECT CONCAT(
    SUBSTRING(value FROM 1 FOR 4), '-',
    SUBSTRING(value FROM 5 FOR 4), '-',
    SUBSTRING(value FROM 9 FOR 4), '-',
    SUBSTRING(value FROM 13 FOR 4)
  )
  FROM (
    SELECT UPPER(REPLACE(pg_catalog.gen_random_uuid()::TEXT, '-', '')) AS value
  ) generated
$$;

REVOKE ALL ON FUNCTION public.generate_company_join_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_company_join_code() TO service_role;

INSERT INTO public.company_join_codes (company_id, join_code, expires_at)
SELECT
  company.id,
  public.generate_company_join_code(),
  (
    DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
  ) AT TIME ZONE 'UTC'
FROM public.companies company
ON CONFLICT (company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_company_join_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.company_join_codes (company_id, join_code, expires_at)
  VALUES (
    NEW.id,
    public.generate_company_join_code(),
    (
      DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
    ) AT TIME ZONE 'UTC'
  )
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_join_code() FROM PUBLIC;

DROP TRIGGER IF EXISTS create_company_join_code_after_insert
  ON public.companies;
CREATE TRIGGER create_company_join_code_after_insert
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_company_join_code();

CREATE OR REPLACE FUNCTION public.rotate_company_join_codes()
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.company_join_codes
  SET join_code = public.generate_company_join_code(),
      expires_at = (
        DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day'
      ) AT TIME ZONE 'UTC',
      updated_at = NOW()
$$;

REVOKE ALL ON FUNCTION public.rotate_company_join_codes() FROM PUBLIC;

-- Supabase Cron uses UTC. Reusing the job name makes this migration idempotent.
SELECT cron.schedule(
  'rotate-company-join-codes-daily',
  '0 0 * * *',
  'SELECT public.rotate_company_join_codes()'
);
