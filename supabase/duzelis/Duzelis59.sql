-- Duzelis59.sql — CRON_SECRET rotasiyası (GitGuardian sızıntısına cavab)
--
-- SƏBƏB: köhnə CRON_SECRET Duzelis50/55.sql fayllarında hardcoded şəkildə
-- GitHub-a düşmüşdü (GitGuardian aşkarladı, 2026-08-28). Git tarixçəsindən
-- silmək praktiki mümkün olmadığı üçün YEGANƏ düzgün həll rotasiyadır:
-- köhnə dəyər ləğv edilir, yeni dəyər həm Edge Function secrets-ə, həm də
-- bütün pg_cron job-larına qoyulur. Bu fayl yeni dəyəri SAXLAMIR —
-- aşağıdakı yer-tutucunu işə salmazdan əvvəl özünüz əvəz edirsiniz.
--
-- ═══════════════════ İCRA QAYDASI (2 addım) ═══════════════════
--
-- ADDIM 1 (ƏVVƏLCƏ BUNU): Supabase Dashboard → Edge Functions → Secrets →
--   CRON_SECRET dəyərini YENİ dəyərlə YENİLƏYİN (chat-da verilmiş dəyər).
--
-- ADDIM 2: Aşağıdakı DO blokunda 'YENI_SECRETI_BURA_YAPISHDIR' hissəsini
--   EYNİ yeni dəyərlə əvəz edin və bütün faylı SQL Editor-də işə salın.
--   Dəyişdirmək unudulsa, skript QƏSDƏN XƏTA VERİR (Duzelis33/39-dakı
--   "unudulmuş yer-tutucu" qəzası bir daha baş verə bilməz).
--
-- Qeyd: ADDIM 1 ilə ADDIM 2 arasındakı qısa pəncərədə cron çağırışları 401
-- ala bilər — növbəti slotda özü bərpa olunur, itki yoxdur (pending məntiqli
-- funksiyalar üçün) və bir neçə dəqiqəlik fasilə zərərsizdir.

DO $$
DECLARE
  -- ▼▼▼ YALNIZ BU SƏTRİ DƏYİŞİN ▼▼▼
  new_secret text := 'YENI_SECRETI_BURA_YAPISHDIR';
  -- ▲▲▲ YALNIZ BU SƏTRİ DƏYİŞİN ▲▲▲
  base_url text := 'https://tntbjulojatnrqmylorp.supabase.co/functions/v1/';
  jobs text[][] := ARRAY[
    ['send-daily-notifications-slots-secure',    '0 5,6,8,10,11,15 * * *',                  'send-daily-notifications'],
    ['send-daily-notifications-halfhour-secure', '30 10,11,15 * * *',                       'send-daily-notifications'],
    ['send-flow-reminders-every-hour-secure',    '0 5,6,7,8,9,10,11,12,13,14,15,16,17 * * *','send-flow-reminders'],
    ['send-vitamin-reminders-every-5min-secure', '*/5 * * * *',                             'send-vitamin-reminders'],
    ['expire-partner-links-daily-secure',        '0 5 * * *',                               'expire-partner-links']
  ];
  j text[];
BEGIN
  IF new_secret = 'YENI_SECRETI_BURA_YAPISHDIR' OR length(new_secret) < 20 THEN
    RAISE EXCEPTION 'DAYAN: yeni CRON_SECRET yapışdırılmayıb! new_secret sətrini əvəz edin.';
  END IF;

  FOREACH j SLICE 1 IN ARRAY jobs LOOP
    -- cron.schedule eyni ad üzrə mövcud job-u əvəzləyir (idempotent)
    PERFORM cron.schedule(
      j[1],
      j[2],
      format(
        $c$SELECT net.http_post(
          url:='%s%s',
          headers:='{"Content-Type": "application/json", "x-cron-secret": "%s"}'::jsonb,
          body:=concat('{"time": "', now(), '"}')::jsonb
        ) as request_id;$c$,
        base_url, j[3], new_secret
      )
    );
  END LOOP;

  RAISE NOTICE '5 cron job yeni secret ilə yeniləndi.';
END $$;

-- ─────────────────────────────────────────────────────────────
-- YOXLAMA 1 (dərhal): bütün 5 job aktiv olmalı və command-da YENİ secret
-- görünməlidir (köhnə z-bKLs4... HEÇ YERDƏ qalmamalıdır):
--   SELECT jobname, schedule, active,
--          command LIKE '%z-bKLs4%' AS kohne_secret_qalib  -- hamısında FALSE olmalıdır
--   FROM cron.job WHERE jobname LIKE '%-secure' ORDER BY jobname;
--
-- YOXLAMA 2 (növbəti cron slotundan sonra): 401 yox, real göndərişlər:
--   SELECT function_name, started_at, sent_count, failed_count
--   FROM notification_run_log ORDER BY started_at DESC LIMIT 10;
