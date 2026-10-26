-- First add all needed columns
ALTER TABLE public.pregnancy_daily_content 
ADD COLUMN IF NOT EXISTS pregnancy_day INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS days_until_birth INTEGER,
ADD COLUMN IF NOT EXISTS body_changes TEXT,
ADD COLUMN IF NOT EXISTS daily_tip TEXT;

-- Create index for fast lookup by pregnancy day
CREATE INDEX IF NOT EXISTS idx_pregnancy_content_day ON public.pregnancy_daily_content(pregnancy_day);