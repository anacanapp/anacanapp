
-- =========================================================================
-- 1) app_settings — remove blanket public SELECT
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;

-- (Admins can manage app settings policy already exists for admin access)

-- =========================================================================
-- 2) community_posts — enforce group membership
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can view active posts" ON public.community_posts;
-- "Members can view group posts" policy already enforces group_id IS NULL OR membership

-- =========================================================================
-- 3) realtime.messages — scope channel access by topic containing user_id
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can receive realtime broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime broadcasts" ON realtime.messages;

-- Allow subscribe/receive only when the channel topic embeds the user's auth uid,
-- or for shared/public topics that don't carry private user data.
-- Convention: private topics include the user_id (e.g. "partner_messages:<uid>").
-- Public topics start with "public:" prefix.
CREATE POLICY "Users can subscribe to their own realtime channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'public:%'
  OR realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

CREATE POLICY "Users can broadcast on their own realtime channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'public:%'
  OR realtime.topic() LIKE '%' || auth.uid()::text || '%'
);
