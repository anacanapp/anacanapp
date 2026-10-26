-- Duzelis60.sql — Cron job-ların BİRDƏFƏLİK, rotasiyadan asılı olmayan bərpası
--
-- PROBLEM: Push bildirişlər (gündəlik məzmun, flow, vitamin-server, partner-link
-- expiry) getmir — yalnız cihazdaxili LOKAL bildirişlər (su, vitamin toggle) gəlir.
--
-- DİAQNOZ (2026-09-02, canlı sistemdə yoxlanıldı):
--   • send-daily-notifications funksiyası anon Bearer ilə çağırıldı →
--     "No device tokens" cavabı qayıtdı. Bu o deməkdir ki:
--       ✓ Edge funksiya deploy olunub və işləyir
--       ✓ FIREBASE_SERVICE_ACCOUNT_JSON mövcuddur
--       ✓ Firebase access token UĞURLA alınır (FCM boru xətti tam sağlamdır)
--   • Deməli yeganə qırıq halqa: pg_cron job-ları. Onlar hələ də köhnə
--     (GitGuardian sızıntısından sonra LƏĞV EDİLMİŞ) CRON_SECRET və ya
--     Duzelis59-un dəyişdirilməmiş yer-tutucusu ilə çağırış edir → 401 →
--     funksiya gövdəsinə çatmır → heç nə göndərilmir, heç bir log yazılmır.
--
-- HƏLL: x-cron-secret-dən İMTİNA. requireCronSecret (functions/_shared/auth.ts,
-- sətir 129-139) layihənin PUBLIC anon açarını Bearer/apikey kimi qəbul edir
-- (həm SUPABASE_ANON_KEY env müqayisəsi, həm iss/ref/role JWT yoxlaması ilə).
-- Anon açar dizayn etibarilə publikdir (client bundle-da və .env-də onsuz da
-- mövcuddur) — sızıntı riski YOXDUR, gələcək CRON_SECRET rotasiyaları bu
-- job-lara TƏSİR ETMİR. Duzelis33/39/44/59-dakı "yer-tutucu unudulub" sinif
-- qəzaları bir daha mümkün deyil, çünki bu faylda yer-tutucu yoxdur.
--
-- İCRA: Bu faylı OLDUĞU KİMİ Supabase SQL Editor-də işə salın. Heç nəyi
-- dəyişməyə ehtiyac yoxdur. Dashboard-da heç bir secret dəyişikliyi lazım deyil.

DO $$
DECLARE
  -- Layihənin publishable (anon) açarı — publikdir, client-də onsuz da var.
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzYyOTksImV4cCI6MjA4NDQxMjI5OX0.uwaOZsWTw8GBUg6s9GqmbA3EluGf44PmGdUI80RhGNU';
  base_url text := 'https://tntbjulojatnrqmylorp.supabase.co/functions/v1/';
  -- Cədvəllər Duzelis55/59 ilə eynidir (UTC; Bakı = UTC+4):
  --   daily slots    : Bakı 09,10,12,14,15,19  (DAILY_RUN_SLOTS-un tam saatları)
  --   daily halfhour : Bakı 14:30, 15:30, 19:30 (yarım-saat slotları)
  --   flow hourly    : Bakı 09-21 hər saat
  --   vitamin        : hər 5 dəqiqə
  --   partner expiry : Bakı 09:00
  -- Job adları NotificationOpsCard-ın gözlədiyi adlarla EYNİ saxlanılıb.
  jobs text[][] := ARRAY[
    ['send-daily-notifications-slots-secure',    '0 5,6,8,10,11,15 * * *',                    'send-daily-notifications'],
    ['send-daily-notifications-halfhour-secure', '30 10,11,15 * * *',                         'send-daily-notifications'],
    ['send-flow-reminders-every-hour-secure',    '0 5,6,7,8,9,10,11,12,13,14,15,16,17 * * *', 'send-flow-reminders'],
    ['send-vitamin-reminders-every-5min-secure', '*/5 * * * *',                               'send-vitamin-reminders'],
    ['expire-partner-links-daily-secure',        '0 5 * * *',                                 'expire-partner-links']
  ];
  j text[];
  legacy record;
BEGIN
  -- 1) Bizim 5 addan KƏNAR qalmış, eyni funksiyalara vuran köhnə/legacy
  --    job-ları təmizlə (401 səs-küyü və ikiqat göndəriş olmasın)
  FOR legacy IN
    SELECT jobid, jobname FROM cron.job
    WHERE (command LIKE '%send-daily-notifications%'
        OR command LIKE '%send-flow-reminders%'
        OR command LIKE '%send-vitamin-reminders%'
        OR command LIKE '%expire-partner-links%')
      AND jobname NOT IN (
        'send-daily-notifications-slots-secure',
        'send-daily-notifications-halfhour-secure',
        'send-flow-reminders-every-hour-secure',
        'send-vitamin-reminders-every-5min-secure',
        'expire-partner-links-daily-secure'
      )
  LOOP
    PERFORM cron.unschedule(legacy.jobid);
    RAISE NOTICE 'Legacy job silindi: %', legacy.jobname;
  END LOOP;

  -- 2) 5 əsas job-u anon-Bearer autentifikasiyası ilə (yenidən) qur.
  --    cron.schedule eyni ad üzrə mövcud job-u əvəzləyir (idempotent).
  FOREACH j SLICE 1 IN ARRAY jobs LOOP
    PERFORM cron.schedule(
      j[1],
      j[2],
      format(
        $c$SELECT net.http_post(
          url:='%s%s',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer %s", "apikey": "%s"}'::jsonb,
          body:=concat('{"time": "', now(), '"}')::jsonb
        ) as request_id;$c$,
        base_url, j[3], anon_key, anon_key
      )
    );
    RAISE NOTICE 'Job quruldu: % (%)', j[1], j[2];
  END LOOP;

  RAISE NOTICE '5 cron job anon-Bearer auth ilə yeniləndi — CRON_SECRET-dən asılılıq qalmadı.';
END $$;

-- ─────────────────────────────────────────────────────────────
-- YOXLAMA 1 (dərhal): 5 job aktiv, heç birində köhnə secret/yer-tutucu yoxdur:
--   SELECT jobname, schedule, active,
--          command LIKE '%x-cron-secret%' AS kohne_secret_formati  -- hamısı FALSE
--   FROM cron.job WHERE jobname LIKE '%-secure' ORDER BY jobname;
--
-- YOXLAMA 2 (5-10 dəqiqə sonra — vitamin job-u hər 5 dəqiqədən bir işləyir):
--   SELECT function_name, started_at, triggered_by, status, sent_count, skipped_count
--   FROM notification_run_log ORDER BY started_at DESC LIMIT 10;
--   → triggered_by='cron' sətirləri görünməlidirsə, boru xətti bərpa olunub.
--
-- YOXLAMA 3 (növbəti gündəlik slotdan sonra, məs. Bakı 19:00):
--   SELECT count(*), status FROM notification_send_log
--   WHERE sent_at > now() - interval '1 day' GROUP BY status;
