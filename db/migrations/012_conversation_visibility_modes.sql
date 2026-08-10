-- Add owner-only and admins-only options alongside company-wide conversations.
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_visibility_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_visibility_check
  CHECK (visibility IN ('private', 'company', 'admins'));

-- Keep this migration self-contained for databases where the company chat
-- columns predate the repository migration history.
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

CREATE OR REPLACE FUNCTION public.current_user_company_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT profile.user_type
  FROM public.users profile
  WHERE profile.id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_user_company_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_company_role() TO authenticated;

DROP POLICY IF EXISTS "Company members can view company conversations"
  ON public.conversations;
DROP POLICY IF EXISTS "Company members can view permitted conversations"
  ON public.conversations;
CREATE POLICY "Company members can view permitted conversations"
  ON public.conversations FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      company_id = public.current_company_id()
      AND (
        visibility = 'company'
        OR (
          visibility = 'admins'
          AND public.current_user_company_role() = 'admin'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own conversations"
  ON public.conversations;
DROP POLICY IF EXISTS "Users can insert permitted conversations"
  ON public.conversations;
CREATE POLICY "Users can insert permitted conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_company_id()
    AND (
      visibility IN ('private', 'company')
      OR (
        visibility = 'admins'
        AND public.current_user_company_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own conversations"
  ON public.conversations;
DROP POLICY IF EXISTS "Users can update permitted conversations"
  ON public.conversations;
CREATE POLICY "Users can update permitted conversations"
  ON public.conversations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.current_company_id()
    AND (
      visibility IN ('private', 'company')
      OR (
        visibility = 'admins'
        AND public.current_user_company_role() = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "Company members can view company conversation messages"
  ON public.conversation_messages;
DROP POLICY IF EXISTS "Company members can view permitted conversation messages"
  ON public.conversation_messages;
CREATE POLICY "Company members can view permitted conversation messages"
  ON public.conversation_messages FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.conversations conversation
      WHERE conversation.id = conversation_messages.conversation_id
        AND conversation.company_id = public.current_company_id()
        AND (
          conversation.visibility = 'company'
          OR (
            conversation.visibility = 'admins'
            AND public.current_user_company_role() = 'admin'
          )
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_conversations_company_visibility_updated
  ON public.conversations(company_id, visibility, updated_at DESC);
