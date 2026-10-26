-- Add notification settings columns to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sound_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS vibration_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS water_reminder boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS vitamin_reminder boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS exercise_reminder boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vitamin_time text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS exercise_days integer[] DEFAULT '{1,3,5}',
ADD COLUMN IF NOT EXISTS silent_hours_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS silent_hours_start text DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS silent_hours_end text DEFAULT '08:00';