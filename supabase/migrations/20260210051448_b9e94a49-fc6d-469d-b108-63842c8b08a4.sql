-- Fix vitamins RLS policy to use user_roles table instead of profiles.role
DROP POLICY IF EXISTS "Admins can manage vitamins" ON public.vitamins;

CREATE POLICY "Admins can manage vitamins"
ON public.vitamins
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);