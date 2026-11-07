-- Crash reports: drop expected, non-actionable outcomes at insert time (2026-11-07).
-- Old app builds (45/47/48) report every push that was not delivered for normal reasons — recipient has no
-- device token, turned notifications off, the push was already sent, or left the group — plus a user cancelling
-- Google sign-in. That was ~22k rows a week and hid the real errors. Builds since 2 Nov no longer send them;
-- this trigger filters the old builds. Real failures ("invoke error …", contract errors, JS crashes) still land.
-- Existing relation (already CDC-enrolled and writer-guarded); only a BEFORE INSERT row trigger is added, which
-- fires before the statement-level guard's row work and simply skips the row. No new relation, no cron.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.crash_reports_drop_noise_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF NEW.error_message ~ '^\[push:[a-z_]+\] (no_device_tokens|preferences_disabled|duplicate|not_member)$'
     OR NEW.error_message ~* '^\[auth:[a-z]+\] .*(user canceled|user cancelled|cancelled by user|canceled by user|popup_closed|12501)' THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION public.crash_reports_drop_noise_v1() OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.crash_reports_drop_noise_v1() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS anacan_crash_drop_noise ON public.crash_reports;
CREATE TRIGGER anacan_crash_drop_noise BEFORE INSERT ON public.crash_reports
  FOR EACH ROW EXECUTE FUNCTION public.crash_reports_drop_noise_v1();
COMMIT;
