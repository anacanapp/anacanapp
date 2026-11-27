-- Yuxu təlimi (2026-11-08): the sleep-training plan follows the child, not the phone.
--
--   * sleep_training_plans: one row per (owner, child): the tool's plan jsonb (wake time, chosen method and
--     14-day ratings, method steps, bedtime routine and night wake-ups of the last 30 days, safety checklist,
--     a running sleep timer) and updated_at. The app keeps the device copy first (localStorage per account and
--     child) and syncs in the background: the newest updated_at wins; a write only replaces an older row.
--   * RLS: the owner (the mother's account) reads and writes her rows; child_id must be one of her children.
--     Her linked partner reads them while she shares baby logs (public.partner_can_see_v1(user_id,
--     'baby_logs'), the same switch as baby_logs). Partners do not write: like baby_logs, the plan is hers.
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP, one transaction).
-- The new relation is enrolled in CDC and writer guarding here (the migration refuses without the guard
-- catalog). No cron or timer.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'SLEEP_PLAN_GUARD_CATALOG_MISSING';
  END IF;
  IF to_regprocedure('public.partner_can_see_v1(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'SLEEP_PLAN_PARTNER_HELPER_MISSING';
  END IF;
  IF to_regclass('public.user_children') IS NULL THEN
    RAISE EXCEPTION 'SLEEP_PLAN_CHILDREN_MISSING';
  END IF;
END $$;

-- ── Plans (owner writes, linked partner reads) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sleep_training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.user_children(id) ON DELETE CASCADE,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(plan) = 'object' AND octet_length(plan::text) <= 65536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sleep_training_plans_user_child_key UNIQUE NULLS NOT DISTINCT (user_id, child_id)
);
CREATE INDEX IF NOT EXISTS sleep_training_plans_child_idx ON public.sleep_training_plans (child_id);

ALTER TABLE public.sleep_training_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sleep_training_plans FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_training_plans TO authenticated;
GRANT ALL ON public.sleep_training_plans TO service_role;

DROP POLICY IF EXISTS sleep_training_plans_own ON public.sleep_training_plans;
CREATE POLICY sleep_training_plans_own ON public.sleep_training_plans
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (child_id IS NULL OR EXISTS (
      SELECT 1 FROM public.user_children c WHERE c.id = sleep_training_plans.child_id AND c.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS sleep_training_plans_partner_read ON public.sleep_training_plans;
CREATE POLICY sleep_training_plans_partner_read ON public.sleep_training_plans
  FOR SELECT TO authenticated
  USING (public.partner_can_see_v1(user_id, 'baby_logs'));

-- ── Ownership ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.sleep_training_plans OWNER TO pgadmin';
  END IF;
END $$;

-- ── CDC and writer-guard enrollment of the new relation ────────────────────────────────
INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key) VALUES
  ('public', 'sleep_training_plans', ARRAY['id'])
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sleep_training_plans'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_change ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.%I', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
    EXECUTE format('CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change()', t);
  END LOOP;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
      AND table_name = 'sleep_training_plans') <> 1
     OR (SELECT count(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'sleep_training_plans'
           AND tg.tgname IN ('anacan_gcp_writer_guard', 'anacan_gcp_change', 'anacan_gcp_truncate')) <> 3 THEN
    RAISE EXCEPTION 'SLEEP_PLAN_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
