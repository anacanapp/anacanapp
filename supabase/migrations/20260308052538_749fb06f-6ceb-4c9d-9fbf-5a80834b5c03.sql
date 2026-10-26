ALTER TABLE public.notification_send_log 
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_notification_id text;

CREATE INDEX IF NOT EXISTS idx_notification_send_log_dedup 
  ON public.notification_send_log (user_id, source_type, source_notification_id, sent_at);