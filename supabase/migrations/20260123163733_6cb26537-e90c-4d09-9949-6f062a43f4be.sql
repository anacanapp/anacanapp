-- Fix baby_logs constraints to match application code

-- Drop existing constraints
ALTER TABLE public.baby_logs DROP CONSTRAINT IF EXISTS baby_logs_log_type_check;
ALTER TABLE public.baby_logs DROP CONSTRAINT IF EXISTS baby_logs_feed_type_check;
ALTER TABLE public.baby_logs DROP CONSTRAINT IF EXISTS baby_logs_diaper_type_check;

-- Add updated constraints that match application values
ALTER TABLE public.baby_logs 
ADD CONSTRAINT baby_logs_log_type_check 
CHECK (log_type IN ('sleep', 'feed', 'feeding', 'diaper'));

ALTER TABLE public.baby_logs 
ADD CONSTRAINT baby_logs_feed_type_check 
CHECK (feed_type IN ('left', 'right', 'breast_left', 'breast_right', 'formula', 'solid'));

ALTER TABLE public.baby_logs 
ADD CONSTRAINT baby_logs_diaper_type_check 
CHECK (diaper_type IN ('wet', 'dirty', 'both', 'mixed'));