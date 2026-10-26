-- Fix RLS policy for tool_configs to allow admin updates
-- Drop existing policy and recreate with proper WITH CHECK clause

DROP POLICY IF EXISTS "Admins can manage tools" ON public.tool_configs;

CREATE POLICY "Admins can manage tools" 
ON public.tool_configs 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));