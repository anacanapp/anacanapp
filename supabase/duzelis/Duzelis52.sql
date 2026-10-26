-- Duzelis52: Community-nin ÜMUMİ (qlobal) axını ÖLKƏYƏ görə seqmentləşdirilir
--
-- TƏLƏB: Azərbaycanı ölkə kimi qeyd edən istifadəçi YALNIZ Azərbaycana aid
-- şəxslərin postlarını görsün, Qazaxıstan-Qazaxıstana, Türkiyə-Türkiyəyə və s.
-- Qrup-daxili (mövzu üzrə, məs. "Doğum Ayı") postlar bu qaydaya tabe DEYİL —
-- YALNIZ qlobal (group_id IS NULL) axın ölkəyə görə süzülür.
--
-- HƏYATA KEÇİRMƏ YERİ: RLS (client-tərəfi .eq() YOX) — bu, is_group_member()
-- ilə EYNİ, artıq mövcud olan nümunədir (qrup-üzvlüyü yoxlaması da məhz belə
-- edilir), və client sorğularını (useGroupPosts, useUnreadCommunityPosts,
-- realtime abunəlikləri) TƏK bir yerdən, avtomatik və bypass-edilməz şəkildə
-- qoruyur — hər sorğunu ayrı-ayrı dəyişməyə EHTİYAC YOXDUR.
--
-- NULL-TOLERANT: tərəflərdən (baxan VƏ YA müəllif) hər hansı birinin
-- country_code-u NULL-dursa, uyğunluq HƏLƏ DƏ var sayılır — profiles.
-- country_code sütunu YALNIZ 2026-06-27-dən sonra əlavə olunub (community
-- feature isə 2026-01-22-dən bəri mövcuddur), yəni çoxlu mövcud
-- istifadəçi/post-un ölkəsi hələ təyin edilməyib. Sərt filtr onları
-- birbaşa "gizli" edərdi.

CREATE OR REPLACE FUNCTION public.is_same_country(_viewer_id uuid, _author_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles v, public.profiles a
    WHERE v.user_id = _viewer_id AND a.user_id = _author_id
      AND (v.country_code IS NULL OR a.country_code IS NULL OR v.country_code = a.country_code)
  )
$$;

REVOKE ALL ON FUNCTION public.is_same_country(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_same_country(uuid, uuid) TO authenticated;

-- ── community_posts: qlobal axın YALNIZ eyni ölkə, qrup axını əvvəlki kimi ──
DROP POLICY IF EXISTS "Members can view group posts" ON public.community_posts;
CREATE POLICY "Members can view group posts"
ON public.community_posts
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    (group_id IS NULL AND public.is_same_country(auth.uid(), user_id))
    OR (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id))
  )
);

-- ── community_stories: eyni məntiq (tutarlılıq üçün) ──
DROP POLICY IF EXISTS "Authenticated users can view active stories" ON public.community_stories;
CREATE POLICY "Authenticated users can view active stories"
ON public.community_stories
FOR SELECT
TO authenticated
USING (
  expires_at > now()
  AND (
    (group_id IS NULL AND public.is_same_country(auth.uid(), user_id))
    OR (group_id IS NOT NULL AND public.is_group_member(auth.uid(), group_id))
  )
);

-- YOXLAMA:
--   SELECT public.is_same_country('<user-a-uuid>', '<user-b-uuid>');
--   SELECT count(*) FROM public.community_posts; -- öz sessiyanla (authenticated) test et
