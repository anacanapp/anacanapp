-- Duzelis54: Duzelis53.sql-in 3-cü addımındakı SƏHV UPDATE-in ZƏRƏRİNİ AZALTMAQ
--
-- NƏ BAŞ VERDİ: Duzelis53.sql-in son UPDATE-inin WHERE şərti həddindən artıq
-- geniş idi (`country_code = 'AZ'` demək olar ki, BÜTÜN istifadəçilərə uyğun
-- gəlir, `content ILIKE '%ə%'` demək olar ki, İSTƏNİLƏN normal Azərbaycan
-- mətninə uyğun gəlir) — nəticədə YALNIZ bir neçə səhv "ölkəsi" olan
-- istifadəçinin YOX, demək olar ki, BÜTÜN aktiv postların created_at-i "indi"
-- anına dəyişdi. Bu, feed-in xronologiyasını pozdu (köhnə postlar "təzə"
-- göründü, əsl təzə postlar bunların arasında itdi).
--
-- BACKUP/RESTORE-POINT YOXDUR (istifadəçi təsdiqlədi) — ona görə əsl created_at
-- dəyərləri artıq HEÇ YERDƏ saxlanmır və 100% dəqiq bərpa mümkün DEYİL.
--
-- HƏLL (ən yaxşı mümkün yaxınlaşma):
--   1) "Zədələnmiş" sətirləri DƏQİQ tapmaq: `now()` bir SQL ifadəsi daxilində
--      YALNIZ BİR DƏFƏ hesablanır — yəni Duzelis53-ün toxunduğu BÜTÜN sətirlər
--      created_at-də HƏRFİ EYNİ (mikrosaniyəyə qədər) dəyərə malikdir. Adi/əsl
--      postların bir-birindən tamamilə fərqli, təbii vaxt möhürləri olduğu üçün,
--      "eyni created_at-ə malik çoxlu sətir" — bu, "bu sətirlər süni şəkildə
--      dəyişdirilib" demək üçün ETİBARLI bir imzadır. YALNIZ bu sətirlərə
--      toxunulur — həqiqi YENİ postlar (öz unikal, təbii vaxtları ilə) TAMAMİL�ə
--      TOXUNULMAZ qalır.
--   2) Bu zədələnmiş sətirlər üçün: onlara aid şərh/bəyənmə cədvəllərinin
--      (post_comments, post_likes — bunlara Duzelis53 HEÇ TOXUNMAYIB, əsl
--      tarixlərini saxlayırlar) ƏN ERKƏN qeydini "bu post ən azı bu vaxta
--      qədər mövcud olmalı idi" siqnalı kimi istifadə edir.
--   3) Heç bir şərh/bəyənməsi olmayan postlar üçün: istifadəçinin öz qeydiyyat
--      tarixi ilə "zədələnmiş" tarix arasında təsadüfi bir nöqtə seçilir (ən
--      azı MƏNTİQİ ardıcıllıq qorunur — qeydiyyatdan ƏVVƏL post ola bilməz).
--
-- ⚠️ BU TƏXMİNİ BƏRPADIR, MÜKƏMMƏL DEYİL — əsl dəqiq tarixlər artıq bərpa
-- oluna bilməz. Məqsəd: feed-i "hamısı indicə" xaosundan çıxarıb, ən azı
-- MƏNTİQİ/təxmini düzgün xronoloji sıraya qaytarmaqdır.

-- ─────────────────────────────────────────────────────────────
-- ADDIM 1 (ƏVVƏLCƏ BUNU İŞLƏT VƏ NƏTİCƏYƏ BAX): şübhəli "eyni an" qrupları
-- ─────────────────────────────────────────────────────────────
SELECT created_at, count(*) AS row_count
FROM public.community_posts
WHERE is_active = true
GROUP BY created_at
HAVING count(*) > 3
ORDER BY row_count DESC;
-- Gözlənilən: 1 (bəlkə bir neçə, əgər skript bir neçə dəfə işlədilibsə) sətir,
-- YÜKSƏK row_count (məsələn, yüzlərlə/minlərlə) ilə. Bu, YUXARIDA izah edilən
-- "zədələnmə imzası"dır. Əgər bura HEÇ NƏ qayıtmırsa (0 sətir), demək
-- zədələnmə güman edildiyi qədər geniş olmayıb — bu halda ADDIM 2-ni
-- İŞLƏTMƏYİN, mənə xəbər verin ki, başqa yanaşma tapaq.

-- ─────────────────────────────────────────────────────────────
-- ADDIM 2: bərpa (YALNIZ Addım 1-in nəticəsini gördükdən sonra işlədin)
-- ─────────────────────────────────────────────────────────────
WITH bad_timestamps AS (
  SELECT created_at
  FROM public.community_posts
  WHERE is_active = true
  GROUP BY created_at
  HAVING count(*) > 3
),
earliest_activity AS (
  SELECT post_id, MIN(activity_at) AS first_activity
  FROM (
    SELECT post_id, created_at AS activity_at FROM public.post_comments
    UNION ALL
    SELECT post_id, created_at AS activity_at FROM public.post_likes
  ) all_activity
  GROUP BY post_id
),
targets AS (
  SELECT
    p.id,
    p.created_at AS bad_created_at,
    ea.first_activity,
    pr.created_at AS profile_created_at
  FROM public.community_posts p
  JOIN bad_timestamps bt ON p.created_at = bt.created_at
  LEFT JOIN earliest_activity ea ON ea.post_id = p.id
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE p.is_active = true
)
UPDATE public.community_posts p
SET created_at = COALESCE(
  -- 1) Ən erkən şərh/bəyənmədən 2 dəqiqə əvvəl (ən etibarlı siqnal)
  t.first_activity - interval '2 minutes',
  -- 2) Heç bir aktivliyi yoxdursa: qeydiyyat tarixi ilə zədələnmə anı arasında təsadüfi nöqtə
  t.profile_created_at + (random() * (t.bad_created_at - t.profile_created_at)),
  -- 3) Profil tarixi də yoxdursa (nadir): zədələnmə anından 30 gün geri
  t.bad_created_at - interval '30 days'
)
FROM targets t
WHERE p.id = t.id;

-- YOXLAMA (bərpa etdikdən sonra):
--   SELECT created_at, count(*) FROM public.community_posts WHERE is_active = true GROUP BY created_at HAVING count(*) > 3;
--   -- (indi boş qayıtmalıdır — "eyni an" qrupu artıq yoxdur)
--   SELECT id, created_at FROM public.community_posts WHERE is_active = true ORDER BY created_at DESC LIMIT 30;
--   -- (sıralama indi məntiqli görünməlidir)
