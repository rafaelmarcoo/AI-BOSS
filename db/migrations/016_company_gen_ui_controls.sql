-- Move planning horizon to the shared company profile and add worker roles.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS planning_horizon INTEGER NOT NULL DEFAULT 6;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companies_planning_horizon_check'
      AND conrelid = 'public.companies'::regclass
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_planning_horizon_check
      CHECK (planning_horizon IN (3, 6, 12));
  END IF;
END
$$;

-- Preserve an existing admin horizon before removing the old per-user field.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_gen_ui_preferences'
      AND column_name = 'planning_horizon'
  ) THEN
    UPDATE public.companies company
    SET planning_horizon = preferences.planning_horizon
    FROM public.user_gen_ui_preferences preferences
    WHERE preferences.user_id = company.created_by
      AND preferences.planning_horizon IN (3, 6, 12);
  END IF;
END
$$;

ALTER TABLE public.user_gen_ui_preferences
  DROP CONSTRAINT IF EXISTS user_gen_ui_preferences_horizon_check,
  DROP CONSTRAINT IF EXISTS user_gen_ui_preferences_role_check;

-- Translate any preferences saved before admin and worker roles were separated.
UPDATE public.user_gen_ui_preferences preferences
SET decision_role = CASE preferences.decision_role
  WHEN 'finance' THEN 'accountant'
  WHEN 'manager' THEN 'operations'
  ELSE 'team_member'
END
FROM public.users profile
WHERE profile.id = preferences.user_id
  AND profile.user_type = 'employee'
  AND preferences.decision_role IN ('owner', 'finance', 'manager');

UPDATE public.user_gen_ui_preferences preferences
SET decision_role = CASE preferences.decision_role
  WHEN 'accountant' THEN 'finance'
  WHEN 'operations' THEN 'manager'
  ELSE 'manager'
END
FROM public.users profile
WHERE profile.id = preferences.user_id
  AND profile.user_type = 'admin'
  AND preferences.decision_role IN ('accountant', 'operations', 'team_member');

ALTER TABLE public.user_gen_ui_preferences
  ADD CONSTRAINT user_gen_ui_preferences_role_check
  CHECK (
    decision_role IN (
      'owner',
      'finance',
      'manager',
      'accountant',
      'operations',
      'team_member'
    )
  ),
  DROP COLUMN IF EXISTS planning_horizon;
