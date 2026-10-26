
-- ============================================================
-- 1. PROFILES: prevent self-elevation to premium/admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins and service role full control
  IF public.has_role(auth.uid(), 'admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block changes to privileged columns by non-admin users
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    NEW.is_premium := OLD.is_premium;
  END IF;
  IF NEW.premium_until IS DISTINCT FROM OLD.premium_until THEN
    NEW.premium_until := OLD.premium_until;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  IF NEW.badge_type IS DISTINCT FROM OLD.badge_type THEN
    NEW.badge_type := OLD.badge_type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- ============================================================
-- 2. SUBSCRIPTIONS: remove user write access (only admin/service)
-- ============================================================
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

CREATE POLICY "Admins can manage subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. PAYMENT_TRANSACTIONS: remove user UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Users can update own pending transactions" ON public.payment_transactions;

-- Service role / edge functions still bypass RLS

-- ============================================================
-- 4. APP_SETTINGS: revoke public SELECT
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
-- "Admins can manage app settings" stays

-- ============================================================
-- 5. Community / public-likes tables: require authenticated
-- ============================================================
DROP POLICY IF EXISTS "Members can view group posts" ON public.community_posts;
CREATE POLICY "Members can view group posts"
ON public.community_posts
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (group_id IS NULL OR public.is_group_member(auth.uid(), group_id))
);

DROP POLICY IF EXISTS "Users can view active stories" ON public.community_stories;
CREATE POLICY "Authenticated users can view active stories"
ON public.community_stories
FOR SELECT
TO authenticated
USING (expires_at > now());

DROP POLICY IF EXISTS "Anyone can view post likes" ON public.post_likes;
CREATE POLICY "Authenticated can view post likes"
ON public.post_likes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can view comment likes" ON public.comment_likes;
CREATE POLICY "Authenticated can view comment likes"
ON public.comment_likes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anyone can view comment likes" ON public.blog_comment_likes;
CREATE POLICY "Authenticated can view blog comment likes"
ON public.blog_comment_likes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can view all badges" ON public.user_badges;
CREATE POLICY "Authenticated can view badges"
ON public.user_badges
FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- 6. STORAGE: convert sensitive buckets to private
-- ============================================================
UPDATE storage.buckets
SET public = false
WHERE id IN ('baby-photos', 'baby-album', 'pregnancy-album');
