
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'az';

ALTER TABLE public.mommy_daily_messages ADD COLUMN IF NOT EXISTS message_en TEXT;
ALTER TABLE public.baby_daily_info ADD COLUMN IF NOT EXISTS info_en TEXT;
ALTER TABLE public.flow_reminders ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE public.flow_reminders ADD COLUMN IF NOT EXISTS message_en TEXT;

ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_development_en TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS baby_message_en TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_tips_en TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS mother_warnings_en TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS nutrition_tip_en TEXT;
ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS exercise_tip_en TEXT;

UPDATE public.app_languages SET is_active = true WHERE code = 'en';

INSERT INTO public.app_settings (key, value, description)
VALUES (
  'language_switcher_enabled',
  'true'::jsonb,
  'Settings ekranında dil seçicinin görünməsini idarə edir. False olarsa hər kəs AZ-da qalır.'
)
ON CONFLICT (key) DO NOTHING;
