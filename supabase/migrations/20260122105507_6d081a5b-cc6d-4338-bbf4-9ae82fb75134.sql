-- Fix remaining recursive policies on community_posts that reference group_memberships

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can create posts in groups" ON public.community_posts;
DROP POLICY IF EXISTS "Members can view group posts" ON public.community_posts;

-- Recreate using the security definer function
CREATE POLICY "Members can create posts in groups"
ON public.community_posts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (
    group_id IS NULL 
    OR public.is_group_member(auth.uid(), group_id)
  )
);

CREATE POLICY "Members can view group posts"
ON public.community_posts
FOR SELECT
USING (
  is_active = true 
  AND (
    group_id IS NULL 
    OR public.is_group_member(auth.uid(), group_id)
  )
);