ALTER TABLE public.pregnancy_daily_content
  ADD COLUMN IF NOT EXISTS baby_size_fruit_en text,
  ADD COLUMN IF NOT EXISTS body_changes_en text,
  ADD COLUMN IF NOT EXISTS daily_tip_en text;