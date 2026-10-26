-- Duzelis63.sql — "Naməlum ölkə" probleminin həlli (app update TƏLƏB ETMİR)
--
-- KÖK SƏBƏBLƏR (araşdırma nəticəsi):
--   1) profiles.country_code sütunu yalnız 2026-06-27-də əlavə olunub —
--      ondan əvvəlki BÜTÜN hesablar NULL-dur.
--   2) Apple/Google girişləri heç vaxt ölkə göndərmir (ID token-də ölkə yoxdur,
--      onboarding-lərdə ölkə addımı yoxdur) → OAuth istifadəçiləri həmişə NULL.
--   3) İlk açılışda seçilən ölkə userStore persist-inə daxil deyildi (partialize
--      bug) — qeyri-az dillərdə dərhal reload olduğundan seçim silinirdi.
--   4) Email/partner qeydiyyatında ölkə sahəsi məcburi deyildi.
--
-- BU FAYLIN HƏLLİ (mövcud buildlərə DƏRHALl təsir edir):
--   A) IP-dən avtomatik ölkə tutma: Supabase REST API Cloudflare arxasındadır və
--      PostgREST bütün sorğu başlıqlarını `request.headers` GUC-u ilə DB-yə ötürür —
--      Cloudflare isə hər sorğuya `cf-ipcountry` (ISO-2) əlavə edir. Mövcud
--      buildlər HƏR ekran açılışında analytics_events-ə INSERT edir → trigger
--      həmin andaca istifadəçinin ölkəsini profiles-a yazır (yalnız NULL olanda).
--      Yəni köhnə build işlədən hər AKTİV istifadəçinin ölkəsi növbəti
--      açılışda avtomatik dolur — heç bir update olmadan.
--   B) Konservativ backfill: dili 'az' olan NULL hesablar → 'AZ'
--      (digər dillər üçün heuristika RİSKLİDİR — Duzelis53 təcrübəsi göstərdi ki,
--      ru/tr dilli istifadəçilərin çoxu əslində Azərbaycandandır; onlara toxunmuruq,
--      onları (A) mexanizmi real IP ilə dəqiq dolduracaq).
--
-- Client tərəfdə (növbəti build + web dərhal): qeydiyyatda ölkə MƏCBURİ edildi,
-- ölkəsiz mövcud istifadəçilərə birdəfəlik məcburi seçim ekranı (CountryGate),
-- partialize bug-ı düzəldildi.
--
-- İCRA: Bu faylı OLDUĞU KİMİ Supabase SQL Editor-də işə salın.

-- ═══════════════════════════════════════════════════════════════
-- A) IP-dən avtomatik ölkə tutma trigger-i
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.capture_country_from_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cc text;
BEGIN
  -- Yalnız istifadəçili sətirlər üçün
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- PostgREST sorğu başlıqları; edge/dashboard sorğularında olmaya bilər
    cc := upper(trim((current_setting('request.headers', true))::json ->> 'cf-ipcountry'));
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW; -- başlıq yoxdursa/parse alınmırsa — sakitcə keç
  END;

  -- Yalnız etibarlı ISO-2 kodlar (XX=naməlum, T1=Tor CF xüsusi kodlarıdır)
  IF cc IS NULL OR cc !~ '^[A-Z]{2}$' OR cc IN ('XX', 'T1') THEN
    RETURN NEW;
  END IF;

  -- YALNIZ boş olanda doldur — istifadəçinin öz seçimi heç vaxt əzilmir
  UPDATE public.profiles
  SET country_code = cc
  WHERE user_id = NEW.user_id
    AND (country_code IS NULL OR trim(country_code) = '');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- bu trigger HEÇ VAXT əsas insert-i sındırmamalıdır
END;
$$;

-- analytics_events: hər ekran açılışında yazılır → ən geniş əhatə.
-- device_tokens: push qeydiyyatı (app açılışı) → analytics söndürülübsə belə tutur.
DROP TRIGGER IF EXISTS trg_capture_country ON public.analytics_events;
CREATE TRIGGER trg_capture_country
  BEFORE INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.capture_country_from_request();

DROP TRIGGER IF EXISTS trg_capture_country ON public.device_tokens;
CREATE TRIGGER trg_capture_country
  BEFORE INSERT ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.capture_country_from_request();

-- ═══════════════════════════════════════════════════════════════
-- B) Konservativ backfill: az dilli NULL hesablar → AZ
-- ═══════════════════════════════════════════════════════════════
UPDATE public.profiles p
SET country_code = 'AZ'
FROM public.user_preferences up
WHERE up.user_id = p.user_id
  AND up.language = 'az'
  AND (p.country_code IS NULL OR trim(p.country_code) = '');

-- ─────────────────────────────────────────────────────────────
-- YOXLAMA 1 (dərhal): backfill nə qədər doldurdu?
--   SELECT count(*) FILTER (WHERE country_code IS NULL OR trim(country_code)='') AS bosh_qalan,
--          count(*) FILTER (WHERE country_code = 'AZ') AS az_sayi,
--          count(*) AS cemi
--   FROM profiles;
--
-- YOXLAMA 2 (bir neçə saat sonra): IP tutma işləyirmi?
--   Naməlum sayı hər app açılışı ilə azalmalıdır. Trigger-in işlədiyini
--   birbaşa test etmək üçün: hər hansı istifadəçi ilə app-ı açın (analytics
--   event yazılır) və həmin user-in profiles.country_code-una baxın.
--
-- YOXLAMA 3: başlıq həqiqətən gəlirmi? (истənilən cədvələ RLS-siz test əvəzinə)
--   SELECT (current_setting('request.headers', true))::json ->> 'cf-ipcountry';
--   -- QEYD: SQL Editor-dən NULL qayıda bilər (dashboard sorğuları PostgREST-dən
--   -- keçmir) — real yoxlama app/REST sorğusu ilə olur (YOXLAMA 2).
