-- anacan-notification-test-requests (2026-10-27): admin "test send" buttons on Google.
--
-- On Google the daily / cycle / vitamin senders run only as scheduled job images, so the admin
-- buttons that invoked them as functions returned 404. Instead an admin queues a test here and
-- the existing 5-minute notification run (anacan-job-vitamin-reminders) executes the real job in
-- its single-user test mode (TEST_USER_ID) for that admin, then records the result.
--
--   * a test always targets the requesting admin's own account (no broadcast path);
--   * request_notification_test(kind) is admin-only, one open request per kind, 20 per day;
--   * admins read only their own requests (RLS); the job writes status/result as pgadmin.
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP).
-- The new relation is registered for CDC / writer guard like every guarded relation.
-- No cron or timer is added.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.notification_test_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('daily', 'flow', 'vitamin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error', 'expired')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS notification_test_requests_pending_idx
  ON public.notification_test_requests (created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS notification_test_requests_user_idx
  ON public.notification_test_requests (requested_by, created_at DESC);

ALTER TABLE public.notification_test_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read own notification tests" ON public.notification_test_requests;
CREATE POLICY "Admins read own notification tests" ON public.notification_test_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() AND public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.notification_test_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.notification_test_requests TO authenticated;

-- ── Queue a test for yourself (admins only) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_notification_test(p_kind text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'NOTIFICATION_TEST_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('daily', 'flow', 'vitamin') THEN
    RAISE EXCEPTION 'NOTIFICATION_TEST_KIND' USING ERRCODE = '22023';
  END IF;
  -- Reuse an open request of the same kind instead of queueing duplicates.
  SELECT id INTO v_id FROM public.notification_test_requests
   WHERE requested_by = v_uid AND kind = p_kind AND status IN ('pending', 'running')
     AND created_at > now() - interval '30 minutes'
   ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  IF (SELECT count(*) FROM public.notification_test_requests
       WHERE requested_by = v_uid AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'NOTIFICATION_TEST_RATE_LIMIT' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.notification_test_requests (requested_by, kind)
  VALUES (v_uid, p_kind) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.request_notification_test(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_notification_test(text) TO authenticated;

-- ── CDC + writer guard enrollment (same shape as every guarded relation) ─────────
DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_TEST_GUARD_CATALOG_MISSING';
  END IF;
  INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
  SELECT 'public', 'notification_test_requests', ARRAY['id'] WHERE NOT EXISTS (
    SELECT 1 FROM _anacan_gcp_migration.guarded_relations
     WHERE schema_name = 'public' AND table_name = 'notification_test_requests');
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.notification_test_requests;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.notification_test_requests;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.notification_test_requests;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.notification_test_requests
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.notification_test_requests
    FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.notification_test_requests
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
END $$;

-- ── Ownership: same owner as the other app objects ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.notification_test_requests OWNER TO pgadmin';
    EXECUTE 'ALTER FUNCTION public.request_notification_test(text) OWNER TO pgadmin';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
