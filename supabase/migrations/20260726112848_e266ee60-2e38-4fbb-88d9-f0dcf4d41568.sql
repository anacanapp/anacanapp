
ALTER TABLE public.scheduled_notifications
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS body_en text;

UPDATE public.flow_reminders
SET title_en = COALESCE(title_en, 'Pill time 💊'),
    message_en = COALESCE(message_en, 'Don''t forget to take your daily pill!')
WHERE reminder_type = 'pill' AND (title_en IS NULL OR message_en IS NULL);
