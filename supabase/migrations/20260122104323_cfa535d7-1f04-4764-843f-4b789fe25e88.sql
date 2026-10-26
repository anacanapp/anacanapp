-- Drop existing problematic policies on group_memberships
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.group_memberships;
DROP POLICY IF EXISTS "Users can view all memberships" ON public.group_memberships;
DROP POLICY IF EXISTS "Users can join groups" ON public.group_memberships;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_memberships;
DROP POLICY IF EXISTS "Anyone can view memberships" ON public.group_memberships;

-- Create simple, non-recursive policies for group_memberships
CREATE POLICY "Users can view own memberships"
ON public.group_memberships
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memberships"
ON public.group_memberships
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memberships"
ON public.group_memberships
FOR DELETE
USING (auth.uid() = user_id);

-- Fix community_posts policies to avoid recursion
DROP POLICY IF EXISTS "Users can view posts in their groups" ON public.community_posts;
DROP POLICY IF EXISTS "Users can view public posts" ON public.community_posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.community_posts;

-- Simple policies for community_posts
CREATE POLICY "Anyone can view active posts"
ON public.community_posts
FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can create posts"
ON public.community_posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
ON public.community_posts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
ON public.community_posts
FOR DELETE
USING (auth.uid() = user_id);