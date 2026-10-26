-- Allow anyone to check if a partner code exists (only returns id, user_id, name)
-- This is needed for partner registration flow before the user is authenticated
CREATE POLICY "Anyone can search profiles by partner code"
ON public.profiles
FOR SELECT
USING (true);

-- Drop the old restrictive policy and replace with the above
-- Actually, let's be more specific - only allow viewing partner_code, id, user_id, name columns
-- Since we can't do column-level RLS in Postgres, we'll use a security definer function instead

-- First, let's drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can search profiles by partner code" ON public.profiles;

-- Create a security definer function to find partner by code
CREATE OR REPLACE FUNCTION public.find_partner_by_code(p_partner_code text)
RETURNS TABLE (id uuid, user_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.name
  FROM public.profiles p
  WHERE p.partner_code = p_partner_code
  LIMIT 1;
$$;