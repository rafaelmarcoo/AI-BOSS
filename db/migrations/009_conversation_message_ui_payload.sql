-- Persist generated UI plans alongside assistant messages so conversation
-- reloads can restore the right-side dashboard workspace.
ALTER TABLE public.conversation_messages
ADD COLUMN IF NOT EXISTS ui_payload JSONB;

COMMENT ON COLUMN public.conversation_messages.ui_payload IS
  'Validated Gen UI plan rendered in the dashboard for this assistant turn.';
