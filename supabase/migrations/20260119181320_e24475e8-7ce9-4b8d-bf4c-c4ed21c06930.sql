-- Fix security: Ensure only authenticated users can access tables
-- Drop existing overly permissive policies if any

-- Ensure profiles table is secure - authenticated only
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Add explicit deny for anon access
CREATE POLICY "Authenticated users only on profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Ensure daily_logs is authenticated only
DROP POLICY IF EXISTS "Anyone can view daily_logs" ON public.daily_logs;

CREATE POLICY "Authenticated users can view daily_logs"
  ON public.daily_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure baby_logs is authenticated only  
DROP POLICY IF EXISTS "Anyone can view baby_logs" ON public.baby_logs;

CREATE POLICY "Authenticated users can view baby_logs"
  ON public.baby_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);