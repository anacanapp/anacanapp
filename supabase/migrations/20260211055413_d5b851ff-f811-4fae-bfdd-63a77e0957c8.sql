-- Drop the unique constraint on day_number
ALTER TABLE public.pregnancy_day_notifications 
DROP CONSTRAINT IF EXISTS pregnancy_day_notifications_day_number_key;

-- Add send_time column
ALTER TABLE public.pregnancy_day_notifications 
ADD COLUMN IF NOT EXISTS send_time TEXT NOT NULL DEFAULT '09:00';

-- Add composite unique constraint for day_number + send_time
ALTER TABLE public.pregnancy_day_notifications 
ADD CONSTRAINT pregnancy_day_notifications_day_time_unique UNIQUE (day_number, send_time);