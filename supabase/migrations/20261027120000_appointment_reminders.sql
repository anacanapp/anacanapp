-- anacan-appointment-reminders (2026-10-27): server push reminders for appointments.
--
--   * appointments gains reminder_day_sent_at / reminder_soon_sent_at. The notification job
--     claims a reminder by setting its column (UPDATE … WHERE … IS NULL RETURNING), so each
--     reminder is pushed at most once even if two runs overlap;
--   * changing the date, time or reminder switch clears both markers, so an edited
--     appointment is reminded again for its new time;
--   * a partial index keeps the job's per-run scan on upcoming, reminder-enabled rows only.
--
-- Reminders (Baku time): the day before at 10:00, and 2 hours before when a time is set.
-- They are sent by the existing anacan-job-vitamin-reminders run (no new timer, cron0).
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP). The
-- changed relation must already be CDC/writer-guard enrolled; the migration refuses otherwise.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ── The changed relation must already be guarded ───────────────────────────────
DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'APPOINTMENT_GUARD_CATALOG_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations
                 WHERE schema_name = 'public' AND table_name = 'appointments')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = 'appointments'
                      AND tg.tgname = 'anacan_gcp_writer_guard') THEN
    RAISE EXCEPTION 'APPOINTMENT_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

-- ── Reminder markers ───────────────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_day_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_soon_sent_at timestamptz;

-- Rows that are already in the past never need a reminder.
UPDATE public.appointments
   SET reminder_day_sent_at = coalesce(reminder_day_sent_at, now()),
       reminder_soon_sent_at = coalesce(reminder_soon_sent_at, now())
 WHERE event_date < (timezone('Asia/Baku', now()))::date
   AND (reminder_day_sent_at IS NULL OR reminder_soon_sent_at IS NULL);

CREATE INDEX IF NOT EXISTS appointments_reminder_due_idx
  ON public.appointments (event_date)
  WHERE reminder_enabled IS NOT FALSE AND (reminder_day_sent_at IS NULL OR reminder_soon_sent_at IS NULL);

-- ── Edits re-arm the reminders ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.appointments_rearm_reminders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.event_date IS DISTINCT FROM OLD.event_date
     OR NEW.event_time IS DISTINCT FROM OLD.event_time
     OR (NEW.reminder_enabled IS NOT FALSE AND OLD.reminder_enabled IS FALSE) THEN
    NEW.reminder_day_sent_at := NULL;
    NEW.reminder_soon_sent_at := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.appointments_rearm_reminders() FROM PUBLIC;

DROP TRIGGER IF EXISTS appointments_rearm_reminders ON public.appointments;
CREATE TRIGGER appointments_rearm_reminders
  BEFORE UPDATE OF event_date, event_time, reminder_enabled ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_rearm_reminders();

-- RLS and grants are unchanged. A user could only set her own markers, which at most
-- suppresses her own reminder; the app never writes them.

NOTIFY pgrst, 'reload schema';
COMMIT;
