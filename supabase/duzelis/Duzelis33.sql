-- ============================================================
-- Duzelis33: KRİTİK təhlükəsizlik düzəlişləri (audit tapıntıları)
--
-- 1) subscriptions cədvəli: istifadəçi özü UPDATE/INSERT edərək özünə
--    sonsuz Premium/Premium Plus verə bilirdi (20260611064529 bunu
--    yenidən açmışdı). İndi YENIDƏN admin/service-role-only edilir —
--    YALNIZ yeni sync-revenuecat-entitlement edge function (service-role
--    ilə) yaza bilər. Yeni istifadəçilər üçün default 'free' sətri artıq
--    klient-tərəfi insert əvəzinə profil yaradılanda avtomatik yaranır
--    (ensure_default_subscription trigger, ensure_default_user_role ilə
--    eyni sınanmış nümunə).
--
-- 2) Referral fraud: update_my_referral_status RPC klientin öz bəyanını
--    ('converted') yoxlamadan qəbul edirdi — istənilən istifadəçi dostuna
--    real alış olmadan +7 gün premium "hədiyyə" edə bilirdi. İndi
--    'converted' keçidi YALNIZ yeni confirm_referral_conversion()
--    (service-role-only, RevenueCat-ın öz REST API-sindən real yoxlamadan
--    sonra sync-revenuecat-entitlement tərəfindən çağırılır) vasitəsilə
--    baş verə bilər. _grant_premium_days də (əvvəllər PUBLIC-dən
--    çağırıla bilən) sərtləşdirilir.
--
-- 3) Cron auth: pg_cron işləri (send-daily-notifications/send-flow-reminders/
--    send-vitamin-reminders) HƏR TƏTBİQ QURULUŞUNDA olan public anon key-i
--    "cron sirri" kimi göndərirdi — bu key .env-də və hər build-də mövcud
--    olduğu üçün ISTƏNILƏN İSTİFADƏÇİ bütün istifadəçi bazasına təkrar
--    mass-bildiriş göndərə bilərdi. İndi yeganə etibarlı yol x-cron-secret
--    başlığıdır (bax _shared/auth.ts kod dəyişikliyi).
--    !!! DİQQƏT: Aşağıda 3 yerdə '__CRON_SECRET__' yerinə Supabase Edge
--    Function Secrets-də ARTIQ MÖVCUD OLAN (və ya hazırladığınız YENİ) real
--    CRON_SECRET dəyərini tap-dəyiş edin — bu SQL-i işlətməzdən ƏVVƏL. Əks
--    halda planlaşdırılan push-lar 401 ilə uğursuz olacaq. Dəyər hər ikisində
--    (bu fayl + Supabase Dashboard → Edge Functions → Secrets → CRON_SECRET)
--    EYNİ olmalıdır.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) SUBSCRIPTIONS: yalnız admin/service-role yaza bilər
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
REVOKE INSERT, UPDATE ON public.subscriptions FROM authenticated;
-- SELECT hələ də "Users can view their own subscription" (ilkin migrasiya) +
-- "Admins can manage subscriptions" (FOR ALL, admin) vasitəsilə işləyir —
-- toxunulmur, istifadəçi öz sətrini oxumağa davam edir.

-- Yeni istifadəçi qeydiyyatdan keçəndə default 'free' sətri avtomatik yaransın
-- (klient-tərəfi "yoxdursa insert et" fallback-ına artıq ehtiyac yoxdur —
-- useSubscription.ts kодunda həmin fallback silinib).
CREATE OR REPLACE FUNCTION public.ensure_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_type, status)
  VALUES (NEW.user_id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_default_subscription() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ensure_default_subscription ON public.profiles;
CREATE TRIGGER trg_ensure_default_subscription
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_default_subscription();

-- Geriyə uyğunluq: mövcud profili olub subscriptions sətri olmayan istifadəçilər
-- üçün də default 'free' sətri yaradılsın (əvvəllər klient-tərəfi yaradılırdı,
-- odur ki əksəriyyətinin artıq var — bu sadəcə əskikləri tamamlayır).
INSERT INTO public.subscriptions (user_id, plan_type, status)
SELECT p.user_id, 'free', 'active'
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2) REFERRAL FRAUD: 'converted' keçidi server-tərəfi təsdiqsiz mümkün olmasın
-- ────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public._grant_premium_days(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._grant_premium_days(UUID, INTEGER) TO service_role;

-- Yeni: yalnız service-role çağıra bilər (sync-revenuecat-entitlement edge
-- function RevenueCat-ın öz REST API-sindən real "NORMAL" (ödənişli, trial
-- deyil) entitlement-i təsdiqlədikdən SONRA çağırır).
CREATE OR REPLACE FUNCTION public.confirm_referral_conversion(p_referred_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
BEGIN
  SELECT * INTO v_ref FROM public.referrals WHERE referred_user_id = p_referred_user_id;
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_referral');
  END IF;

  IF v_ref.referrer_rewarded_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'converted', 'already_rewarded', true);
  END IF;

  UPDATE public.referrals
  SET status = 'converted',
      converted_at = COALESCE(converted_at, now()),
      referrer_rewarded_at = now()
  WHERE id = v_ref.id;

  PERFORM public._grant_premium_days(v_ref.referrer_user_id, v_ref.reward_days);

  RETURN jsonb_build_object('success', true, 'status', 'converted', 'referrer_rewarded', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_referral_conversion(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_referral_conversion(UUID) TO service_role;

-- Klientə açıq RPC-də 'converted' bloklanır — 'trial' hələ də sərbəst qalır
-- (mükafatsız, sadəcə status göstəricisidir, sui-istifadə riski yoxdur).
CREATE OR REPLACE FUNCTION public.update_my_referral_status(p_state TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_state <> 'trial' THEN
    -- 'converted' artıq klientdən qəbul edilmir — yalnız server-side
    -- confirm_referral_conversion() (RevenueCat REST API təsdiqindən sonra).
    RETURN jsonb_build_object('success', false, 'error', 'server_verification_required');
  END IF;

  SELECT * INTO v_ref FROM public.referrals WHERE referred_user_id = auth.uid();
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_referral');
  END IF;

  IF v_ref.status = 'registered' THEN
    UPDATE public.referrals
    SET status = 'trial', trial_started_at = COALESCE(trial_started_at, now())
    WHERE id = v_ref.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'status', 'trial');
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3) CRON AUTH: bütün planlaşdırılmış push job-larını x-cron-secret ilə
--    yenidən qur (anon key-lə işləyən bütün köhnə variantları ləğv et)
--
-- !!! ÖNƏMLİ: '__CRON_SECRET__' yerinə TƏTBİQDƏ ARTIQ MÖVCUD OLAN real
-- CRON_SECRET dəyərini yaz (Supabase Edge Function Secrets-də görə bilərsən)
-- — bu SQL-i işlətməzdən ƏVVƏL 3 yerdə (aşağıda) tap-dəyiş et. Əgər hazırda
-- HEÇ bir CRON_SECRET yoxdursa, yenisini yarat və HƏM buraya, HƏM Supabase
-- Secrets-ə eyni dəyəri yaz.
--
-- Aşağıdakı unschedule bloku KONKRET tarixi ad siyahısı ƏVƏZİNƏ, bu 3
-- funksiyanı (istənilən köhnə ad altında olsa belə) çağıran BÜTÜN cron.job
-- sətirlərini dinamik tapıb silir — bilmədiyimiz/adı fərqli olan köhnə
-- cron-lar da təmizlənir, təkrar/münaqişəli çağırış riski qalmır.
-- ────────────────────────────────────────────────────────────
-- AZURE: pg_net is not available on Azure Database for PostgreSQL Flexible Server,
-- so cron.schedule()+net.http_post() cannot run here. This scheduling is reimplemented
-- via Azure Container Apps Jobs (native cron trigger). See azure-migration/README.md.
-- (Superseded anyway by Duzelis39/44/50.sql below in the original history.)
-- DO $$
-- DECLARE
--   r RECORD;
-- BEGIN
--   FOR r IN
--     SELECT jobid FROM cron.job
--     WHERE command ILIKE '%send-daily-notifications%'
--        OR command ILIKE '%send-flow-reminders%'
--        OR command ILIKE '%send-vitamin-reminders%'
--   LOOP
--     PERFORM cron.unschedule(r.jobid);
--   END LOOP;
-- END $$;
--
-- SELECT cron.schedule(
--   'send-daily-notifications-slots-secure',
--   '0 5,6,10,11,15 * * *',
--   $$
--   SELECT net.http_post(
--     url:='https://tntbjulojatnrqmylorp.supabase.co/functions/v1/send-daily-notifications',
--     headers:='{"Content-Type": "application/json", "x-cron-secret": "__CRON_SECRET__"}'::jsonb,
--     body:=concat('{"time": "', now(), '"}')::jsonb
--   ) as request_id;
--   $$
-- );
--
-- SELECT cron.schedule(
--   'send-flow-reminders-every-hour-secure',
--   '0 5,6,7,8,9,10,11,12,13,14,15,16,17 * * *',
--   $$
--   SELECT net.http_post(
--     url:='https://tntbjulojatnrqmylorp.supabase.co/functions/v1/send-flow-reminders',
--     headers:='{"Content-Type": "application/json", "x-cron-secret": "__CRON_SECRET__"}'::jsonb,
--     body:=concat('{"time": "', now(), '"}')::jsonb
--   ) as request_id;
--   $$
-- );
--
-- SELECT cron.schedule(
--   'send-vitamin-reminders-every-5min-secure',
--   '*/5 * * * *',
--   $$
--   SELECT net.http_post(
--     url:='https://tntbjulojatnrqmylorp.supabase.co/functions/v1/send-vitamin-reminders',
--     headers:='{"Content-Type": "application/json", "x-cron-secret": "__CRON_SECRET__"}'::jsonb,
--     body:=concat('{"time": "', now(), '"}')::jsonb
--   ) as request_id;
--   $$
-- );
