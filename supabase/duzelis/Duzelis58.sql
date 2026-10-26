-- Duzelis58.sql — Community-nin TAM ölkə izolyasiyası (qruplar daxil)
--
-- CARİ VƏZİYYƏT (Duzelis52-dən bəri):
--   • Seqmentasiya ÖLKƏYƏ görədir (profiles.country_code) — dilə görə YOX.
--   • Qlobal axın (group_id IS NULL): ölkəyə görə süzülür ✅
--   • Story-lər (qlobal): ölkəyə görə süzülür ✅
--   • Mövzu qrupları (group_id IS NOT NULL): süzülMÜR ❌ — istənilən ölkənin
--     üzvü qrupdakı BÜTÜN ölkələrin postlarını görürdü.
--
-- BU FAYL: "hər ölkənin öz community-si" tələbini tamamlayır — ölkə filtri
-- QRUP postlarına və QRUP story-lərinə də tətbiq olunur. Qrup konteynerləri
-- ortaq qalır (hər ölkəyə ayrıca qrup yaratmağa ehtiyac yoxdur), amma hər
-- istifadəçi qrupun içində YALNIZ öz ölkəsinin postlarını görür.
--
-- QORUNAN DAVRANIŞLAR:
--   • NULL-tolerantlıq: baxanın VƏ YA müəllifin country_code-u NULL-dursa
--     uyğunluq sayılır (köhnə istifadəçilər gizlənməsin — country_code sütunu
--     community-dən 5 ay sonra yaranıb). İstifadəçi ölkəsini Profil
--     Redaktəsində özü seçə/düzəldə bilər.
--   • Öz postları: müəllif özü-özü ilə həmişə eyni ölkədədir → öz postlarını
--     həmişə görür.
--   • Adminlər: ayrıca "Admins can manage all posts" (FOR ALL) policy-si var,
--     RLS policy-ləri OR ilə birləşir → moderasiya bütün ölkələri görməyə
--     davam edir.
--   • Realtime: Supabase realtime RLS-ə tabedir → yeni post event-ləri də
--     avtomatik yalnız eyni ölkəyə çatır.
--
-- Data-ya toxunulmur (yalnız DROP/CREATE POLICY) — idempotentdir.

-- ── community_posts: ölkə filtri İNDİ HƏM qlobal, HƏM qrup postlarına ──
DROP POLICY IF EXISTS "Members can view group posts" ON public.community_posts;
CREATE POLICY "Members can view group posts"
ON public.community_posts
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND public.is_same_country(auth.uid(), user_id)
  AND (group_id IS NULL OR public.is_group_member(auth.uid(), group_id))
);

-- ── community_stories: eyni məntiq ──
DROP POLICY IF EXISTS "Authenticated users can view active stories" ON public.community_stories;
CREATE POLICY "Authenticated users can view active stories"
ON public.community_stories
FOR SELECT
TO authenticated
USING (
  expires_at > now()
  AND public.is_same_country(auth.uid(), user_id)
  AND (group_id IS NULL OR public.is_group_member(auth.uid(), group_id))
);

-- ─────────────────────────────────────────────────────────────
-- YOXLAMA (SELECT-only, öz sessiyanızla):
--   SELECT count(*) FROM community_posts WHERE group_id IS NOT NULL;
--   -- Fərqli ölkədən test hesabı ilə eyni sorğu → sayı fərqli olmalıdır.
--
-- QEYD (kosmetik, funksional deyil): qrupların üzv sayı (member_count) bütün
-- ölkələr üzrə ümumi qalır — qrup konteyneri ortaqdır. İstənilərsə, gələcəkdə
-- üzv sayı da ölkəyə görə göstərilə bilər (client-side dəyişiklik tələb edir).
