-- User time zone (2026-11-08): user_preferences.timezone, an IANA name written by the app
-- (Intl.DateTimeFormat().resolvedOptions().timeZone) when it differs from the stored value.
--
--   * scripts/notification-jobs/send-vitamin-reminders.mjs uses it once the column exists, so each
--     vitamin schedule fires at the parent's local time; NULL keeps Baku time as before.
--   * user_preferences is already CDC/writer guarded (see supabase/duzelis/Duzelis70.sql); the
--     migration refuses unless it is enrolled in guarded_relations with all three standard triggers.
--     The triggers are left as they are (no drop or recreate): a new nullable column is captured by
--     the existing row trigger.
--   * Own-row RLS and grants on user_preferences are unchanged.
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- No new relation, cron or timer. Not applied yet.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'USER_TIMEZONE_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regclass('public.user_preferences') IS NULL THEN
    RAISE EXCEPTION 'USER_TIMEZONE_BASE_MISSING';
  END IF;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations
       WHERE schema_name = 'public' AND table_name = 'user_preferences') <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'user_preferences' AND NOT tg.tgisinternal
            AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'USER_TIMEZONE_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS timezone text CHECK (timezone IS NULL OR (length(timezone) BETWEEN 1 AND 64 AND timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$'));

COMMENT ON COLUMN public.user_preferences.timezone IS 'IANA time zone of the app (e.g. Asia/Baku); NULL = Baku time. Used by vitamin reminders.';

NOTIFY pgrst, 'reload schema';
COMMIT;
