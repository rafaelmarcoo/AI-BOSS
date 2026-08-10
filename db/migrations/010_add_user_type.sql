-- Distinguish company creators from employees who join an existing company.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_type TEXT;

-- Existing accounts were created before roles existed. They originally created
-- their company profile, so retain access by treating them as administrators.
UPDATE public.users
SET user_type = 'admin'
WHERE user_type IS NULL
  AND company_name IS NOT NULL
  AND TRIM(company_name) <> '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_user_type_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_user_type_check
      CHECK (user_type IN ('admin', 'employee'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_user_type_company_name
  ON public.users(user_type, company_name);
