
-- Clean today's notification_send_log to unblock dedup for the rest of the day
DELETE FROM public.notification_send_log
WHERE sent_at >= (CURRENT_DATE - INTERVAL '1 day');

-- Index for fast dedup lookups by user + source + day
CREATE INDEX IF NOT EXISTS idx_notification_send_log_dedup
ON public.notification_send_log (user_id, source_type, source_notification_id, sent_at);
