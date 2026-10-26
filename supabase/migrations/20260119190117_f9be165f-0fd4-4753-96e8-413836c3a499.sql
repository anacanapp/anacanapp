-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Partners can view linked profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users only on profiles" ON public.profiles;

-- Create a security definer function to check partner link
CREATE OR REPLACE FUNCTION public.get_user_linked_partner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT linked_partner_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Recreate the partners policy using the security definer function
CREATE POLICY "Partners can view linked profile" ON public.profiles
FOR SELECT USING (id = public.get_user_linked_partner_id(auth.uid()));

-- Add unique constraint on user_roles to prevent duplicate roles
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_unique;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);

-- Clean up duplicate roles (keep only one of each role per user)
DELETE FROM public.user_roles a USING public.user_roles b
WHERE a.id > b.id AND a.user_id = b.user_id AND a.role = b.role;