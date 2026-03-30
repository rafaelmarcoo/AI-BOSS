ALTER TABLE public.decision_log
ADD COLUMN IF NOT EXISTS conversation_history JSONB;
