-- Duzelis16: Tier 3 performans auditı — DB indeksləri.
--
-- ⚠️ ÇOX VACİB İCRA QAYDASI ⚠️
-- Bu fayldakı BÜTÜN CREATE/DROP INDEX əmrləri "CONCURRENTLY" açar sözü ilə yazılıb.
-- Bunun səbəbi: adi CREATE INDEX bütöv indeks qurulana qədər CƏDVƏLİ KİLİDLƏYİR —
-- yəni production-da real istifadəçilər həmin cədvələ toxunanda tətbiq "donmuş" kimi
-- görünə bilər (sorğular gözləyib qalır). CONCURRENTLY isə HEÇ bir oxuma/yazmanı
-- BLOKLAMADAN indeks qurur (bir az daha uzun çəkir, amma sıfır kilidləmə riski var).
--
-- MƏHDUDİYYƏT: "CONCURRENTLY" heç vaxt transaction bloku İÇİNDƏ işləyə bilməz.
-- Supabase SQL Editor-da bu faylı BÜTÖV yapışdırıb NORMAL şəkildə "Run" etmək
-- adətən işləyir (hər sətir öz-özlüyündə avtomatik commit olunur, BEGIN/COMMIT
-- əl ilə yazılmayıb). ƏGƏR "CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction block" xətası alsanız — faylı BÜTÖV YOX, HƏR SƏTRİ AYRI-AYRI
-- (bir-bir seçib Run) işlədin.
--
-- ƏGƏR bir CONCURRENTLY əmri yarımçıq kəsilərsə (məs. bağlantı qopsa), arxada
-- "INVALID" (etibarsız) bir indeks qala bilər — bu, zərərsizdir amma yer tutur;
-- belə halda: `DROP INDEX CONCURRENTLY IF EXISTS <ad>;` işlədib sətri yenidən icra edin.
--
-- Idempotent — bütün əmrlər IF NOT EXISTS/IF EXISTS ilədir, təkrar işlətmək təhlükəsizdir.

-- ============================================================
-- 1) affiliate_products — indeks YOX idi (tam cədvəl skan olunurdu)
-- ============================================================
-- Əsas "aktiv məhsulları göstər" sorğusu: is_active=true sıralama is_featured DESC, sort_order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_affiliate_products_active_sort
  ON public.affiliate_products (is_featured DESC, sort_order)
  WHERE is_active = true;

-- .overlaps('life_stages', [...]) massiv-daxilində axtarış — GIN indeksi lazımdır
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_affiliate_products_life_stages
  ON public.affiliate_products USING GIN (life_stages);

-- "Yadda saxladıqlarım" siyahısı: eq(user_id) + order(created_at DESC)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_affiliate_products_user_created
  ON public.saved_affiliate_products (user_id, created_at DESC);

-- ============================================================
-- 2) mom_friendly_places — indeks YOX idi
-- ============================================================
-- Əsas gəzinti: is_active=true, sıralama avg_rating DESC (kateqoriya seçilməyibsə)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mom_friendly_places_active_rating
  ON public.mom_friendly_places (is_active, avg_rating DESC);

-- Kateqoriya filtri seçiləndə: is_active + category + avg_rating DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mom_friendly_places_active_category_rating
  ON public.mom_friendly_places (is_active, category, avg_rating DESC);

-- Rəylər siyahısı: eq(place_id) + eq(is_verified) + order(created_at DESC)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_place_reviews_place_verified_created
  ON public.place_reviews (place_id, is_verified, created_at DESC);

-- ============================================================
-- 3) partner_messages — indeks YOX idi
-- ============================================================
-- Əsas sorğu .or('sender_id.eq.X,receiver_id.eq.X').order(created_at DESC) —
-- OR-un hər iki tərəfi üçün AYRI indeks lazımdır (Postgres bunları Bitmap OR ilə birləşdirir)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_messages_sender_created
  ON public.partner_messages (sender_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_partner_messages_receiver_created
  ON public.partner_messages (receiver_id, created_at DESC);

-- ============================================================
-- 4) shopping_items — indeks YOX idi
-- ============================================================
-- Əsas sorğunun özündə .eq() yoxdur — bütün süzgəcləmə RLS-də olur:
-- "auth.uid() = user_id OR auth.uid() = partner_id". Hər iki sütun üçün indeks lazımdır.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopping_items_user_id
  ON public.shopping_items (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopping_items_partner_id
  ON public.shopping_items (partner_id);

-- ============================================================
-- 5) profiles.life_stage — indeks YOX idi
-- ============================================================
-- Real istifadə: send-flow-reminders edge fn-i .eq('life_stage','flow') edir (gündəlik cron,
-- istifadəçi bazası böyüdükcə bu sorğu getdikcə yavaşlayacaqdı indekssiz).
-- QEYD: profiles.role üçün indeks ƏLAVƏ EDİLMİR — araşdırma göstərdi ki, kodda 'role'
-- sütununa görə YEGANƏ filtr (send-bulk-push edge fn-də) faktiki bug idi (rolüncə heç vaxt
-- 'partner' dəyəri olmur, life_stage-in dəyəridir) — bu bug supabase/functions/send-bulk-push/
-- index.ts-də DÜZƏLDİLDİ (life_stage-ə görə filtrləməyə keçirildi), ona görə 'role' indeksinin
-- real faydası yoxdur.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_life_stage
  ON public.profiles (life_stage);

-- ============================================================
-- 6) Təmizlik — TƏKRARLANAN indekslər (yazma zamanı boş yerə əlavə yük yaradırlar)
-- ============================================================
-- idx_profiles_user_id: profiles.user_id artıq UNIQUE(user_id) ilə öz indeksinə malikdir
DROP INDEX CONCURRENTLY IF EXISTS public.idx_profiles_user_id;

-- idx_subscriptions_user_id: subscriptions.user_id artıq UNIQUE(user_id) ilə öz indeksinə malikdir
DROP INDEX CONCURRENTLY IF EXISTS public.idx_subscriptions_user_id;

-- idx_community_posts_user_id: idx_community_posts_user ilə TAM EYNİ sütun (user_id) — dublikat
DROP INDEX CONCURRENTLY IF EXISTS public.idx_community_posts_user_id;

-- ============================================================
-- QEYD: subscriptions.status üçün indeks ƏLAVƏ EDİLMİR — araşdırma göstərdi ki,
-- kodda (useSubscription.ts, admin ekranları daxil) status sütununa görə HEÇ bir
-- .eq()/.filter() WHERE-şərti yoxdur (yalnız YAZILIR, heç vaxt onunla axtarılmır) —
-- indeks real faydasız yerə yazma yükü yaradardı.
--
-- QEYD: community_posts üçün YENİ indeks əlavə edilmir — artıq mövcud
-- idx_community_posts_lang_feed (language, is_active, group_id, created_at DESC)
-- kompozit indeksi əsas "global feed" və "oxunmamışlar" sorğularını kifayət qədər
-- yaxşı əhatə edir.
-- ============================================================
