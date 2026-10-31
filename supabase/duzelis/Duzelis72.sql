-- Duzelis72 (2026-10-31): pregnancy loss support ("Hamiləliyim davam etmir").
--
--   * profiles gains pregnancy_loss_date (date the pregnancy ended), loss_recovery_active (the
--     8-week recovery mode is on) and loss_share_partner (the mother chose to tell her linked partner).
--   * pregnancy_loss_begin_v1(p_date, p_share_partner): only for the caller's own 'bump' profile.
--     Moves her to 'flow' with no cycle dates (no period predictions or fertility reminders until she
--     chooses to track her cycle), and turns the recovery mode on. Nothing is deleted.
--   * pregnancy_loss_end_v1(p_track_cycle): turns the recovery mode off (her own choice). With
--     p_track_cycle the loss date becomes the cycle start when she has no period date yet (a loss
--     restarts the cycle). The loss date is kept so her memories keep their context.
--   * send-daily-notifications skips users in recovery and their linked partners (function change).
--   * profiles is already CDC/writer guarded; the migration refuses otherwise. No new relation.
--
-- Applied once on Google (psql as supabase_admin, one transaction). No new relation, cron or timer.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'profiles')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND tg.tgname = 'anacan_gcp_writer_guard') THEN
    RAISE EXCEPTION 'PREGNANCY_LOSS_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pregnancy_loss_date date,
  ADD COLUMN IF NOT EXISTS loss_recovery_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loss_share_partner boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_loss_recovery_active_idx ON public.profiles (id) WHERE loss_recovery_active;

CREATE OR REPLACE FUNCTION public.pregnancy_loss_begin_v1(p_date date, p_share_partner boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  updated int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF p_date IS NULL OR p_date > current_date + 1 OR p_date < current_date - 366 THEN
    RAISE EXCEPTION 'LOSS_DATE_INVALID' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles
     SET life_stage = 'flow', last_period_date = NULL, due_date = NULL,
         pregnancy_loss_date = p_date, loss_recovery_active = true,
         loss_share_partner = coalesce(p_share_partner, false), updated_at = now()
   WHERE user_id = me AND life_stage = 'bump';
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 1 THEN RAISE EXCEPTION 'NOT_PREGNANT' USING ERRCODE = '22023'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pregnancy_loss_end_v1(p_track_cycle boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  UPDATE public.profiles
     SET loss_recovery_active = false,
         last_period_date = CASE WHEN p_track_cycle AND last_period_date IS NULL AND life_stage = 'flow'
                                 THEN pregnancy_loss_date ELSE last_period_date END,
         updated_at = now()
   WHERE user_id = me AND loss_recovery_active;
END $$;

ALTER FUNCTION public.pregnancy_loss_begin_v1(date, boolean) OWNER TO pgadmin;
ALTER FUNCTION public.pregnancy_loss_end_v1(boolean) OWNER TO pgadmin;
REVOKE ALL ON FUNCTION public.pregnancy_loss_begin_v1(date, boolean), public.pregnancy_loss_end_v1(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pregnancy_loss_begin_v1(date, boolean), public.pregnancy_loss_end_v1(boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
