-- Duzelis61.sql — Moderasiya sistemi: blok İCRASI + admin story silmə + Active Users düzəlişi
--
-- PROBLEMLƏR:
--   1) user_blocks cədvəli və AdminModeration UI mövcud idi, amma blokun HEÇ BİR
--      real təsiri yox idi — bloklanmış istifadəçi post/şərh/story/DM yaza bilirdi.
--   2) community_stories-də admin siyasəti yox idi — admin başqasının story-sini silə bilmirdi.
--   3) Admin dashboard "Bu gün aktiv" həmişə 0/1 göstərirdi — daily_logs-da admin SELECT
--      siyasəti yoxdur, RLS sayğacı adminin öz sətirlərinə (gündə max 1) endirirdi.
--
-- İCRA: Bu faylı OLDUĞU KİMİ Supabase SQL Editor-də işə salın.

-- ═══════════════════════════════════════════════════════════════
-- 1) BLOK YOXLAMA FUNKSİYASI
--    scope='community' → community + full blokları tutur
--    scope='full'      → yalnız tam (app) blokları
--    Vaxtı keçmiş (expires_at < now()) bloklar avtomatik təsirsizdir.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid, _scope text DEFAULT 'community')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE user_id = _user_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (block_type = 'full' OR block_type = _scope)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_user_blocked(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(uuid, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 2) BLOK İCRASI — BEFORE INSERT trigger-lər (abuse vektorları).
--    Trigger yanaşması RLS "permissive OR" tələsinə düşmür və bütün
--    cədvəllərə eyni cür tətbiq olunur. Xəta kodu client-də tanınır.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enforce_community_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role / sistem yazıları (auth.uid() NULL) toxunulmur
  IF auth.uid() IS NOT NULL AND public.is_user_blocked(auth.uid(), 'community') THEN
    RAISE EXCEPTION 'USER_BLOCKED_COMMUNITY' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'community_posts',    -- post yazmaq
    'post_comments',      -- şərh yazmaq
    'community_stories',  -- story paylaşmaq
    'story_replies',      -- story cavabı
    'direct_messages'     -- şəxsi mesaj (reklam/spam vektoru)
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_block_check ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_block_check BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.enforce_community_block()', t);
  END LOOP;
  RAISE NOTICE 'Blok trigger-ləri 5 cədvələ qoşuldu.';
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3) ADMIN STORY SİLMƏ — community_stories-də admin siyasəti yox idi
--    (post/şərh/story_replies-də var idi). İndi bərabərləşir.
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can manage all stories" ON public.community_stories;
CREATE POLICY "Admins can manage all stories"
ON public.community_stories
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════════════════════════
-- 4) ACTIVE USERS DÜZƏLİŞİ — daily_logs-a admin SELECT siyasəti.
--    UNIQUE(user_id, log_date) sayəsində sətir sayı = unikal aktiv istifadəçi.
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can view all daily logs" ON public.daily_logs;
CREATE POLICY "Admins can view all daily logs"
ON public.daily_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- has_role EXECUTE qrantı (20260514093608 PUBLIC-dən almışdı; 20260813150025
-- bərpa edib — burada idempotent şəkildə zəmanət veririk, əks halda bütün
-- admin analytics sorğuları 42501 ilə səssizcə boş qayıdır):
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- "Bu gün aktiv" üçün DƏQİQ metrika: analytics_events-dən DISTINCT user sayı.
-- (daily_logs yalnız gündəlik qeyd yazan istifadəçiləri tutur — az sayda;
--  analytics_events isə hər ekran açılışında yazılır → real aktivlik.)
-- Yalnız admin üçün nəticə qaytarır, başqalarına 0.
CREATE OR REPLACE FUNCTION public.get_active_users_count(_since timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin') THEN (
      SELECT count(DISTINCT user_id)::integer
      FROM public.analytics_events
      WHERE created_at >= _since
    )
    ELSE 0
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_users_count(timestamptz) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_users_count(timestamptz) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5) user_blocks üçün performans + istifadəçinin öz blokunu oxuması
--    (siyasətlər artıq mövcuddur: "Admins can manage blocks" ALL,
--     "Users can see if they are blocked" SELECT own — dəyişiklik yoxdur)
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_user_blocks_active_lookup
ON public.user_blocks (user_id, is_active, block_type)
WHERE is_active = true;

-- ─────────────────────────────────────────────────────────────
-- YOXLAMA 1: funksiya işləyir?
--   SELECT public.is_user_blocked('00000000-0000-0000-0000-000000000000'::uuid, 'community'); -- false
-- YOXLAMA 2: trigger-lər qoşulub?
--   SELECT event_object_table, trigger_name FROM information_schema.triggers
--   WHERE trigger_name = 'trg_block_check' ORDER BY event_object_table;  -- 5 sətir
-- YOXLAMA 3: admin dashboard-da "Bu gün aktiv" real rəqəm göstərir?
--   SELECT count(*) FROM daily_logs WHERE log_date = current_date;  -- admin kimi
