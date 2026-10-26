-- ⚠️ TƏHLÜKƏSİZLİK (2026-08-28): bu faylda əvvəllər hardcoded CRON_SECRET var idi —
-- GitGuardian sızıntı aşkarladı, secret LƏĞV EDİLDİ və rotasiya olundu (bax Duzelis59.sql).
-- __CRON_SECRET__ yer-tutucusu artıq köhnə (etibarsız) dəyəri əvəz edir. Bu faylı
-- yenidən İŞƏ SALMAYIN — cədvəl dəyişiklikləri artıq tətbiq olunub, cari secret isə
-- Duzelis59.sql ilə qurulub.
--
-- Duzelis55.sql — pregnancy_day/mommy_day pushları demək olar ki, HEÇ KİMƏ getmirdi
--
-- KÖK SƏBƏB (canlı data ilə TƏSDİQLƏNİB, kod/data xətası DEYİL — YALNIZ cron cədvəli):
--   pg_cron job-u "send-daily-notifications-slots-secure" YALNIZ bu 5 Bakı vaxtında
--   işə düşür: 09:00, 10:00, 14:00, 15:00, 19:00 (cədvəl: '0 5,6,10,11,15 * * *').
--
--   Amma edge function-un (send-daily-notifications/index.ts) DAILY_RUN_SLOTS massivi
--   ÜMUMİLİKDƏ 9 vaxt gözləyir: yuxarıdakı 5 + 12:00, 14:30, 15:30, 19:30.
--   Bu 4 əlavə vaxt 2026-05-20 (commit 7ca93071) tarixində KOD-a əlavə olunub, amma
--   heç vaxt uyğun cron sətri YARADILMAYIB — yəni bu 4 slot indiyədək HEÇ VAXT
--   real cron tərəfindən çağırılmayıb.
--
--   Nəticə (canlı sorğularla təsdiqlənib):
--     • pregnancy_day_notifications: BÜTÜN 294 sətir send_time=12:00 — bu slot HEÇ VAXT
--       işə düşmədiyi üçün hamiləlik günlük bildirişləri 100% ölüdür (heç kimə getmir).
--     • mommy_day_notifications: 4380 sətirdən 3720-si (800@12:00 + 800@14:30 +
--       660@15:30 + 1460@19:30) eyni səbəbdən ölüdür — YALNIZ 660@15:00 çatır.
--
--   DÜZƏLİŞ: kodu DƏYİŞMİRİK (9 slot artıq düzgündür) — YALNIZ pg_cron cədvəlini
--   real 9 slota uyğunlaşdırırıq. Data-da (pregnancy_day_notifications/
--   mommy_day_notifications sətirlərində) HEÇ NƏYİ dəyişmirik — bu düzəlişdən sonra
--   mövcud bütün sətirlər avtomatik "çatan" olacaq.
--
--   Təhlükəsizlik qeydi: bu, İSTİFADƏÇİ DATASINA TOXUNMAYAN, sırf YENİ cron
--   tetiklərinin ƏLAVƏ edilməsidir (mövcud sətirlərin UPDATE/DELETE-i yoxdur).
--   cron.schedule() eyni ad üzrə mövcud planı ƏVƏZLƏYİR (idempotent) — təkrar
--   işlətmək təhlükəsizdir.
--
--   CRON_SECRET dəyəri Duzelis50.sql-dəki ilə EYNİDİR (artıq işlək/təsdiqlənib,
--   canlı 5-slotluq job bu dəyərlə uğurla göndərir): dəyişməyə ehtiyac yoxdur.

-- ─────────────────────────────────────────────────────────────
-- ADDIM 0 (DİAQNOSTİKA, YALNIZ SELECT) — dəyişiklikdən ƏVVƏL cari vəziyyəti görün
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'send-daily-notifications%'
ORDER BY jobname;

-- ─────────────────────────────────────────────────────────────
-- ADDIM 1 — mövcud "tam saat" job-unu genişləndir: 12:00 Bakı (08:00 UTC) əlavə et
-- Əvvəlki cədvəl: '0 5,6,10,11,15 * * *'  (Bakı 09:00,10:00,14:00,15:00,19:00)
-- Yeni cədvəl:     '0 5,6,8,10,11,15 * * *' (+ Bakı 12:00)
SELECT cron.schedule(
  'send-daily-notifications-slots-secure',
  '0 5,6,8,10,11,15 * * *',
  $c$
  SELECT net.http_post(
    url:='https://tntbjulojatnrqmylorp.supabase.co/functions/v1/send-daily-notifications',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "__CRON_SECRET__"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $c$
);

-- ADDIM 2 — YENİ job: 3 "yarım saat" Bakı slotu (14:30, 15:30, 19:30 = UTC 10:30,11:30,15:30)
SELECT cron.schedule(
  'send-daily-notifications-halfhour-secure',
  '30 10,11,15 * * *',
  $c$
  SELECT net.http_post(
    url:='https://tntbjulojatnrqmylorp.supabase.co/functions/v1/send-daily-notifications',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "__CRON_SECRET__"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $c$
);

-- ─────────────────────────────────────────────────────────────
-- ADDIM 3 (YOXLAMA) — hər iki job indi görünməli və "active=true" olmalıdır:
--   send-daily-notifications-slots-secure     → schedule = 0 5,6,8,10,11,15 * * *
--   send-daily-notifications-halfhour-secure  → schedule = 30 10,11,15 * * *
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'send-daily-notifications%'
ORDER BY jobname;

-- Bir neçə saat sonra (12:00, 14:30, 15:30 və ya 19:30 Bakı vaxtı keçdikdən sonra)
-- real göndərişləri təsdiqləmək üçün:
--   SELECT started_at, active_slot, sent_count, skipped_count, reasons
--   FROM public.notification_run_log
--   WHERE function_name = 'send-daily-notifications'
--   ORDER BY started_at DESC LIMIT 10;
-- "active_slot" sütununda artıq "12:00", "14:30", "15:30", "19:30" da görünməlidir
-- (əvvəllər YALNIZ 09:00/10:00/14:00/15:00/19:00 görünürdü) və sent_count > 0 olmalıdır.
