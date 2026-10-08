-- Persist the model selected for a conversation without coupling the database
-- to a model allowlist that may evolve independently.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS selected_model TEXT;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_selected_model_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_selected_model_check
  CHECK (
    selected_model IS NULL
    OR CHAR_LENGTH(BTRIM(selected_model)) BETWEEN 1 AND 80
  );
