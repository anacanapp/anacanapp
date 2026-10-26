-- Fix infinite recursion in RLS for group_memberships by removing self-referencing policy

-- 1) Drop the recursive policy
DROP POLICY IF EXISTS "Users can view group members" ON public.group_memberships;

-- 2) Add helper function that bypasses RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_memberships
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- 3) Recreate non-recursive policy to allow viewing members of groups you are in
CREATE POLICY "Users can view members of joined groups"
ON public.group_memberships
FOR SELECT
USING (
  public.is_group_member(auth.uid(), group_id)
);
