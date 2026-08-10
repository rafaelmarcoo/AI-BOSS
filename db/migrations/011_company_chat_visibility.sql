-- Make company identity the read-access boundary for conversation history.
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_normalized_name
  ON public.companies (LOWER(TRIM(name)));

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'company';

INSERT INTO public.companies (name, created_by)
SELECT source.company_name, source.id
FROM (
  SELECT DISTINCT ON (LOWER(TRIM(company_name))) id, TRIM(company_name) AS company_name
  FROM public.users
  WHERE company_name IS NOT NULL AND TRIM(company_name) <> ''
  ORDER BY LOWER(TRIM(company_name)), created_at
) AS source
WHERE NOT EXISTS (
  SELECT 1
  FROM public.companies company
  WHERE LOWER(TRIM(company.name)) = LOWER(source.company_name)
);

UPDATE public.conversations conversation
SET company_id = company.id,
    visibility = 'company'
FROM public.users profile
JOIN public.companies company
  ON LOWER(TRIM(company.name)) = LOWER(TRIM(profile.company_name))
WHERE conversation.user_id = profile.id
  AND conversation.company_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_company_id_fkey'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_visibility_check'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_visibility_check
      CHECK (visibility IN ('company', 'private'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_conversations_company_updated_at
  ON public.conversations(company_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT company.id
  FROM public.users profile
  JOIN public.companies company
    ON LOWER(TRIM(company.name)) = LOWER(TRIM(profile.company_name))
  WHERE profile.id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;

DROP POLICY IF EXISTS "Company members can view company conversations"
  ON public.conversations;
CREATE POLICY "Company members can view company conversations"
  ON public.conversations FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      visibility = 'company'
      AND company_id = public.current_company_id()
    )
  );

DROP POLICY IF EXISTS "Company members can view company conversation messages"
  ON public.conversation_messages;
CREATE POLICY "Company members can view company conversation messages"
  ON public.conversation_messages FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.conversations conversation
      WHERE conversation.id = conversation_messages.conversation_id
        AND conversation.visibility = 'company'
        AND conversation.company_id = public.current_company_id()
    )
  );
