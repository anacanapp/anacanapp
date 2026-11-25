-- Crash reports: two more expected social-push outcomes are dropped at insert time (2026-11-25).
-- send-push-notification now answers 200 (not 502/403) when
--   * every device token of the recipient was rejected by FCM at token level (uninstalled app, stale or
--     malformed token): skipped 'device_tokens_rejected';
--   * the like/comment named by a community push no longer exists (unlike/delete before the background push ran)
--     after the recipient relationship was verified: skipped 'interaction_gone'.
-- Old app builds report every sent=0 answer as "[push:<kind>] <skipped>", so the server filter learns both codes,
-- next to the existing no_device_tokens / preferences_disabled / duplicate / not_member. Real failures
-- ("invoke error …", contract errors, "fanout incomplete", JS crashes) still land.
-- crash_reports is an existing CDC-enrolled, writer-guarded relation; only the body of the existing BEFORE INSERT
-- trigger function changes. No new relation, column, trigger, cron or timer. Applied as supabase_admin/pgadmin.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL
     OR NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'crash_reports')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = 'crash_reports' AND tg.tgname = 'anacan_gcp_writer_guard') THEN
    RAISE EXCEPTION 'CRASH_REPORTS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND c.relname = 'crash_reports' AND tg.tgname = 'anacan_crash_drop_noise')
     OR to_regprocedure('public.crash_auth_cancel_v1(text)') IS NULL THEN
    RAISE EXCEPTION 'CRASH_REPORTS_NOISE_FILTER_MISSING';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.crash_reports_drop_noise_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.error_message ~ '^\[push:[a-z_]+\] (no_device_tokens|preferences_disabled|duplicate|not_member|device_tokens_rejected|interaction_gone)$'
     OR public.crash_auth_cancel_v1(NEW.error_message) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $function$;
ALTER FUNCTION public.crash_reports_drop_noise_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.crash_reports_drop_noise_v1() FROM PUBLIC, anon, authenticated;

COMMIT;
