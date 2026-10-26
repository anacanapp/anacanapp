-- Fix function search path for get_baby_crisis
CREATE OR REPLACE FUNCTION public.get_baby_crisis(baby_age_weeks INT)
RETURNS SETOF public.baby_crisis_periods
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT * FROM public.baby_crisis_periods
  WHERE is_active = true
    AND baby_age_weeks BETWEEN week_start AND week_end
  ORDER BY week_start;
$$;