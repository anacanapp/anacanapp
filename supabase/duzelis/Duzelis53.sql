-- Duzelis53: TƏCİLİ DÜZƏLİŞ — Azərbaycan dilində yazan, amma profilində ölkəsi
-- Azərbaycan olaraq qeyd edilməyən istifadəçilərin postları Azərbaycanlılara
-- görünmür (Duzelis52.sql-dəki ölkəyə-görə-filtr (is_same_country) səbəbindən).
--
-- KÖK SƏBƏB: bu istifadəçilərin profiles.country_code sütunu TR/RU (və ya
-- başqa) kimi qeyd olunub — ehtimal ki, qeydiyyat zamanı UI dili ilə
-- qarışdırılıb/səhvən seçilib — halbuki yazdıqları postların MƏTNİ həqiqətən
-- Azərbaycan dilindədir. Tanınma üsulu: "ə" hərfi (Azərbaycan əlifbasına
-- MƏXSUSDUR — nə Türk əlifbasında, nə də Rus kirillikasında bu hərf YOXDUR,
-- ona görə etibarlı bir işarədir).
--
-- BU FAYL 3 ADDIMDAN İBARƏTDİR:
--   1) ÖNCƏ YOXLAMA (SELECT) — nə qədər sətir təsirlənəcək, əlbəttə görmək üçün
--   2) profiles.country_code → 'AZ' (əsl düzəliş, RLS görünürlüyünü bərpa edir)
--   3) community_posts.language → 'az' + created_at → indi (görünən kimi
--      TƏZƏ kimi görünsün, dil prioritet sıralamasında düzgün yer alsın)
--
-- Addım 1-i əvvəlcə AYRICA işə salıb nəticəyə baxmaq MƏSLƏHƏTDİR, sonra 2 və 3-ü.

-- ─────────────────────────────────────────────────────────────
-- 1) YOXLAMA: hansı istifadəçilər/postlar təsirlənəcək?
-- ─────────────────────────────────────────────────────────────
SELECT
  pr.user_id,
  pr.name,
  pr.country_code AS current_country_code,
  p.id AS post_id,
  p.language AS current_language,
  p.created_at,
  left(p.content, 80) AS content_preview
FROM public.community_posts p
JOIN public.profiles pr ON pr.user_id = p.user_id
WHERE p.is_active = true
  AND p.content ILIKE '%ə%'
  AND (pr.country_code IS NULL OR pr.country_code <> 'AZ')
ORDER BY p.created_at DESC;

-- ─────────────────────────────────────────────────────────────
-- 2) DÜZƏLİŞ: profil ölkəsini 'AZ' et (bu, RLS görünürlüyünü BƏRPA EDİR —
--    Duzelis52.sql-dəki is_same_country() məhz bu sütuna baxır)
-- ─────────────────────────────────────────────────────────────
UPDATE public.profiles pr
SET country_code = 'AZ'
WHERE pr.country_code IS DISTINCT FROM 'AZ'
  AND EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.user_id = pr.user_id
      AND p.is_active = true
      AND p.content ILIKE '%ə%'
  );

-- ─────────────────────────────────────────────────────────────
-- 3) DÜZƏLİŞ: bu istifadəçilərin postlarında dil='az' + tarix=indi
--    (görünən kimi feed-in başında TƏZƏ kimi çıxsın, dil prioritetində
--    düzgün sıralansın)
-- ─────────────────────────────────────────────────────────────
UPDATE public.community_posts p
SET
  language = 'az',
  created_at = now()
FROM public.profiles pr
WHERE p.user_id = pr.user_id
  AND pr.country_code = 'AZ'
  AND p.is_active = true
  AND p.content ILIKE '%ə%'
  AND (p.language IS DISTINCT FROM 'az' OR p.created_at < now() - interval '1 minute');

-- YOXLAMA (bu SQL-i işlətdikdən sonra):
--   SELECT user_id, country_code FROM public.profiles WHERE country_code = 'AZ';
--   SELECT id, language, created_at FROM public.community_posts WHERE content ILIKE '%ə%' ORDER BY created_at DESC LIMIT 20;
